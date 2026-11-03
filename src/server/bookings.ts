import { randomInt } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, type Tx } from "@/db";
import { bookings, professionals, services, user, type BookingStatus } from "@/db/schema";
import { addDaysYmd, fmtDate, fmtTime, isValidYmd, zonedToDate } from "@/lib/time";
import { formatBRL } from "@/lib/money";
import { getSettings } from "./settings";
import { bookingWindow, eligibleProfessionals, expireStaleHolds, loadBusy, loadHours } from "./availability";
import { hoursForDate, isSlotFree } from "./availability-engine";
import { BusinessError, isOverlapError } from "./errors";
import { audit, emitEvent } from "./events";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newBookingCode() {
  let s = "";
  for (let i = 0; i < 7; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export type CreateBookingInput = {
  clientId: string;
  serviceId: string;
  professionalId: string | "any";
  ymd: string;
  startMin: number;
  paymentMethod: "in_person" | "online";
  clientNotes?: string | null;
  /** Agendamento manual pela administradora: ignora antecedência/jornada, mas nunca sobreposição. */
  actor?: { id: string; isAdmin: boolean };
  now?: Date;
};

export async function createBooking(input: CreateBookingInput) {
  const db = await getDb();
  const settings = await getSettings();
  const now = input.now ?? new Date();
  const isAdmin = !!input.actor?.isAdmin;

  if (!isValidYmd(input.ymd) || !Number.isInteger(input.startMin) || input.startMin < 0 || input.startMin >= 24 * 60) {
    throw new BusinessError("Data ou horário inválido.");
  }
  if (!isAdmin) {
    if (input.paymentMethod === "online" && !settings.onlinePaymentEnabled)
      throw new BusinessError("O pagamento online não está disponível no momento.");
    if (input.paymentMethod === "in_person" && !settings.inPersonPaymentEnabled)
      throw new BusinessError("O pagamento no dia não está disponível no momento.");
    if (input.professionalId === "any" && !settings.allowAnyProfessional)
      throw new BusinessError("Escolha uma profissional.");
  }

  const created = await db.transaction(async (tx) => {
    await expireStaleHolds(tx);

    const [svc] = await tx.select().from(services).where(eq(services.id, input.serviceId));
    if (!svc || (!svc.active && !isAdmin)) throw new BusinessError("Este serviço não está disponível.");

    const eligible = await eligibleProfessionals(svc.id, tx);
    let candidates = eligible.map((p) => p.id);
    if (input.professionalId !== "any") {
      if (!candidates.includes(input.professionalId)) {
        if (!isAdmin) throw new BusinessError("Esta profissional não realiza o serviço escolhido.");
        const [pro] = await tx.select().from(professionals).where(eq(professionals.id, input.professionalId));
        if (!pro) throw new BusinessError("Profissional não encontrada.");
      }
      candidates = [input.professionalId];
    }
    if (!candidates.length) throw new BusinessError("Nenhuma profissional disponível para este serviço.");

    const win = bookingWindow(settings, now);
    if (!isAdmin && (input.ymd < win.first || input.ymd > win.last))
      throw new BusinessError("Data fora do período disponível para agendamento.");

    const startsAt = zonedToDate(input.ymd, input.startMin);
    const endsAt = new Date(startsAt.getTime() + svc.durationMin * 60_000);
    const blockEndsAt = new Date(endsAt.getTime() + svc.bufferMin * 60_000);
    if (startsAt.getTime() < now.getTime() - (isAdmin ? 7 * 86_400_000 : 0))
      throw new BusinessError("Não é possível agendar em um horário que já passou.");

    // "Qualquer profissional": distribui para quem tem menos atendimentos no dia
    if (candidates.length > 1) {
      const loads = await tx
        .select({ pro: bookings.professionalId, n: sql<number>`count(*)::int` })
        .from(bookings)
        .where(
          and(
            inArray(bookings.professionalId, candidates),
            inArray(bookings.status, ["pending_payment", "scheduled", "confirmed"]),
            sql`${bookings.startsAt} >= ${zonedToDate(input.ymd, 0)} and ${bookings.startsAt} < ${zonedToDate(addDaysYmd(input.ymd, 1), 0)}`,
          ),
        )
        .groupBy(bookings.professionalId);
      const count = new Map(loads.map((l) => [l.pro, l.n]));
      candidates.sort((a, b) => (count.get(a) ?? 0) - (count.get(b) ?? 0));
    }

    const hours = await loadHours(candidates, tx);
    const busy = await loadBusy(
      candidates,
      new Date(startsAt.getTime() - 86_400_000),
      new Date(blockEndsAt.getTime() + 86_400_000),
      {},
      tx,
    );

    for (const proId of candidates) {
      // Revalidação no servidor (jornada, folgas, bloqueios, outros agendamentos)
      const free = isSlotFree({
        ymd: input.ymd,
        startMin: input.startMin,
        durationMin: svc.durationMin,
        bufferMin: svc.bufferMin,
        hours: isAdmin ? { weekday: 0, startMin: 0, endMin: 24 * 60, breakStartMin: null, breakEndMin: null } : hoursForDate(hours.get(proId) ?? [], input.ymd),
        busy: busy.get(proId) ?? [],
        earliest: isAdmin ? new Date(0) : win.earliest,
      });
      if (!free) continue;

      try {
        // Savepoint: se a constraint de exclusão disparar (corrida), tenta a próxima profissional
        const row = await tx.transaction(async (sp) => {
          const [b] = await sp
            .insert(bookings)
            .values({
              code: newBookingCode(),
              clientId: input.clientId,
              professionalId: proId,
              serviceId: svc.id,
              serviceName: svc.name,
              serviceDescription: svc.description,
              priceCents: svc.priceCents,
              durationMin: svc.durationMin,
              bufferMin: svc.bufferMin,
              startsAt,
              endsAt,
              blockEndsAt,
              status: input.paymentMethod === "online" ? "pending_payment" : "scheduled",
              paymentMethod: input.paymentMethod,
              paymentStatus: "pending",
              holdExpiresAt:
                input.paymentMethod === "online" ? new Date(now.getTime() + settings.holdMinutes * 60_000) : null,
              clientNotes: input.clientNotes?.slice(0, 1000) || null,
              createdBy: input.actor?.id ?? input.clientId,
            })
            .returning();
          return b;
        });
        return row;
      } catch (err) {
        if (isOverlapError(err)) continue;
        throw err;
      }
    }
    throw new BusinessError(
      "Esse horário acabou de ficar indisponível. Escolha outro horário, por favor.",
      "slot_unavailable",
    );
  });

  await audit(input.actor?.id ?? input.clientId, "booking.create", "booking", created.id, {
    code: created.code,
    paymentMethod: created.paymentMethod,
  });
  const [pro] = await db.select({ name: professionals.displayName }).from(professionals).where(eq(professionals.id, created.professionalId));
  await emitEvent({
    type: "booking.created",
    userId: created.clientId,
    bookingId: created.id,
    title: created.paymentMethod === "online" ? "Reserva criada — aguardando pagamento" : "Agendamento confirmado",
    body: `${created.serviceName} com ${pro?.name ?? "nossa equipe"} em ${fmtDate(created.startsAt)} às ${fmtTime(created.startsAt)}. Código ${created.code}. Valor: ${formatBRL(created.priceCents)}${created.paymentMethod === "in_person" ? " (pagamento no dia do atendimento)." : "."}`,
    email: true,
    ctaPath: "/minha-conta",
  });
  return created;
}

async function loadBookingForUpdate(tx: Tx, bookingId: string) {
  const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!b) throw new BusinessError("Agendamento não encontrado.");
  return b;
}

export async function cancelBooking(params: {
  bookingId: string;
  actor: { id: string; isAdmin: boolean };
  reason?: string;
  now?: Date;
}) {
  const db = await getDb();
  const settings = await getSettings();
  const now = params.now ?? new Date();
  const b = await db.transaction(async (tx) => {
    const b = await loadBookingForUpdate(tx, params.bookingId);
    if (!params.actor.isAdmin) {
      if (b.clientId !== params.actor.id) throw new BusinessError("Agendamento não encontrado.");
      if (!settings.allowClientCancel)
        throw new BusinessError("Cancelamentos são feitos diretamente com o estúdio. Fale conosco pelo WhatsApp.");
      const limit = b.startsAt.getTime() - settings.cancelMinHours * 3_600_000;
      if (b.status !== "pending_payment" && now.getTime() > limit)
        throw new BusinessError(
          `Cancelamentos online são permitidos até ${settings.cancelMinHours}h antes do horário. Fale com o estúdio.`,
        );
    }
    if (!["pending_payment", "scheduled", "confirmed"].includes(b.status))
      throw new BusinessError("Este agendamento não pode mais ser cancelado.");

    const [u] = await tx
      .update(bookings)
      .set({
        status: "cancelled",
        // Pago continua "paid" até o reembolso ser registrado; pendente deixa de ser cobrado
        paymentStatus: b.paymentStatus === "pending" ? "not_charged" : b.paymentStatus,
        cancelReason: params.reason?.slice(0, 500) || null,
        cancelledAt: now,
        cancelledBy: params.actor.id,
        holdExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(bookings.id, b.id))
      .returning();
    await audit(params.actor.id, "booking.cancel", "booking", b.id, { reason: params.reason ?? null }, tx);
    return u;
  });

  await emitEvent({
    type: "booking.cancelled",
    userId: b.clientId,
    bookingId: b.id,
    title: "Agendamento cancelado",
    body: `O agendamento ${b.code} (${b.serviceName}, ${fmtDate(b.startsAt)} às ${fmtTime(b.startsAt)}) foi cancelado.${b.paymentStatus === "paid" ? " Como havia pagamento aprovado, o estúdio vai tratar o reembolso com você." : ""}`,
    email: true,
    ctaPath: "/minha-conta",
  });
  return b;
}

export async function rescheduleBooking(params: {
  bookingId: string;
  ymd: string;
  startMin: number;
  professionalId?: string;
  actor: { id: string; isAdmin: boolean };
  now?: Date;
}) {
  const db = await getDb();
  const settings = await getSettings();
  const now = params.now ?? new Date();
  const isAdmin = params.actor.isAdmin;
  if (!isValidYmd(params.ymd)) throw new BusinessError("Data inválida.");

  const updated = await db.transaction(async (tx) => {
    const b = await loadBookingForUpdate(tx, params.bookingId);
    if (!isAdmin) {
      if (b.clientId !== params.actor.id) throw new BusinessError("Agendamento não encontrado.");
      if (!settings.allowClientReschedule)
        throw new BusinessError("Reagendamentos são feitos diretamente com o estúdio.");
      if (now.getTime() > b.startsAt.getTime() - settings.rescheduleMinHours * 3_600_000)
        throw new BusinessError(`Reagendamentos online são permitidos até ${settings.rescheduleMinHours}h antes do horário.`);
    }
    if (!["scheduled", "confirmed"].includes(b.status))
      throw new BusinessError("Só é possível reagendar atendimentos agendados ou confirmados.");

    const proId = isAdmin && params.professionalId ? params.professionalId : b.professionalId;
    const startsAt = zonedToDate(params.ymd, params.startMin);
    const endsAt = new Date(startsAt.getTime() + b.durationMin * 60_000);
    const blockEndsAt = new Date(endsAt.getTime() + b.bufferMin * 60_000);
    const win = bookingWindow(settings, now);
    if (!isAdmin && (params.ymd < win.first || params.ymd > win.last))
      throw new BusinessError("Data fora do período disponível.");

    const hours = await loadHours([proId], tx);
    const busy = await loadBusy([proId], new Date(startsAt.getTime() - 86_400_000), new Date(blockEndsAt.getTime() + 86_400_000), { excludeBookingId: b.id }, tx);
    const free = isSlotFree({
      ymd: params.ymd,
      startMin: params.startMin,
      durationMin: b.durationMin,
      bufferMin: b.bufferMin,
      hours: isAdmin ? { weekday: 0, startMin: 0, endMin: 1440, breakStartMin: null, breakEndMin: null } : hoursForDate(hours.get(proId) ?? [], params.ymd),
      busy: busy.get(proId) ?? [],
      earliest: isAdmin ? new Date(0) : win.earliest,
    });
    if (!free) throw new BusinessError("Este horário não está disponível. Escolha outro.", "slot_unavailable");

    try {
      const [u] = await tx.transaction((sp) =>
        sp
          .update(bookings)
          .set({ startsAt, endsAt, blockEndsAt, professionalId: proId, rescheduledFrom: b.startsAt, updatedAt: now })
          .where(eq(bookings.id, b.id))
          .returning(),
      );
      await audit(params.actor.id, "booking.reschedule", "booking", b.id, { from: b.startsAt.toISOString(), to: startsAt.toISOString(), professionalId: proId }, tx);
      return u;
    } catch (err) {
      if (isOverlapError(err)) throw new BusinessError("Este horário acabou de ser reservado. Escolha outro.", "slot_unavailable");
      throw err;
    }
  });

  await emitEvent({
    type: "booking.rescheduled",
    userId: updated.clientId,
    bookingId: updated.id,
    title: "Agendamento reagendado",
    body: `${updated.serviceName} foi remarcado para ${fmtDate(updated.startsAt)} às ${fmtTime(updated.startsAt)}. Código ${updated.code}.`,
    email: true,
    ctaPath: "/minha-conta",
  });
  return updated;
}

/** Atualiza o status do atendimento (independente do status financeiro). */
export async function setAttendanceStatus(bookingId: string, status: Extract<BookingStatus, "scheduled" | "confirmed" | "completed" | "no_show">, actorId: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const b = await loadBookingForUpdate(tx, bookingId);
    if (["cancelled", "expired"].includes(b.status)) throw new BusinessError("Agendamento cancelado/expirado não pode mudar de status.");
    if (b.status === "pending_payment" && status !== "confirmed")
      throw new BusinessError("Esta reserva aguarda pagamento online. Confirme-a antes de registrar o atendimento.");
    const now = new Date();
    const [u] = await tx
      .update(bookings)
      .set({
        status,
        holdExpiresAt: null,
        checkedInAt: status === "completed" ? (b.checkedInAt ?? now) : status === "no_show" ? null : b.checkedInAt,
        completedAt: status === "completed" ? now : null,
        updatedAt: now,
      })
      .where(eq(bookings.id, bookingId))
      .returning();
    await audit(actorId, `booking.status.${status}`, "booking", bookingId, { from: b.status }, tx);
    return u;
  });
}

/** Registra o comparecimento (chegada da cliente). */
export async function checkInBooking(bookingId: string, actorId: string) {
  const db = await getDb();
  const [b] = await db
    .update(bookings)
    .set({ checkedInAt: new Date(), updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), inArray(bookings.status, ["scheduled", "confirmed"])))
    .returning();
  if (!b) throw new BusinessError("Só é possível registrar chegada em atendimentos agendados ou confirmados.");
  await audit(actorId, "booking.checkin", "booking", bookingId);
  return b;
}

export async function getBookingForUser(bookingId: string, userId: string) {
  const db = await getDb();
  const [row] = await db
    .select({
      booking: bookings,
      professionalName: professionals.displayName,
      clientName: user.name,
    })
    .from(bookings)
    .innerJoin(professionals, eq(professionals.id, bookings.professionalId))
    .innerJoin(user, eq(user.id, bookings.clientId))
    .where(and(eq(bookings.id, bookingId), eq(bookings.clientId, userId)));
  return row ?? null;
}
