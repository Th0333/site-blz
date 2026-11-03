import { and, asc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { getDb, type DB, type Tx } from "@/db";
import {
  BLOCKING_STATUSES,
  bookings,
  professionals,
  serviceProfessionals,
  services,
  timeOff,
  workingHours,
} from "@/db/schema";
import { addDaysYmd, hhmm, todayYmd, zonedToDate } from "@/lib/time";
import type { StudioSettings } from "@/lib/settings-schema";
import { computeSlots, hoursForDate, type Busy, type DayHours } from "./availability-engine";

type Conn = DB | Tx;

/** Libera reservas temporárias de pagamento online que expiraram. */
export async function expireStaleHolds(conn?: Conn) {
  const db = conn ?? (await getDb());
  await db
    .update(bookings)
    .set({ status: "expired", paymentStatus: "not_charged", updatedAt: new Date() })
    .where(and(eq(bookings.status, "pending_payment"), lt(bookings.holdExpiresAt, new Date())));
}

export async function getBookableService(serviceId: string, conn?: Conn) {
  const db = conn ?? (await getDb());
  const [svc] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.active, true)));
  return svc ?? null;
}

/** Profissionais ativas habilitadas para o serviço. */
export async function eligibleProfessionals(serviceId: string, conn?: Conn) {
  const db = conn ?? (await getDb());
  return db
    .select({
      id: professionals.id,
      displayName: professionals.displayName,
      slug: professionals.slug,
      specialties: professionals.specialties,
      bio: professionals.bio,
      photoId: professionals.photoId,
    })
    .from(serviceProfessionals)
    .innerJoin(professionals, eq(professionals.id, serviceProfessionals.professionalId))
    .where(and(eq(serviceProfessionals.serviceId, serviceId), eq(professionals.active, true)))
    .orderBy(asc(professionals.sortOrder), asc(professionals.displayName));
}

export async function loadHours(proIds: string[], conn?: Conn): Promise<Map<string, DayHours[]>> {
  const db = conn ?? (await getDb());
  const map = new Map<string, DayHours[]>();
  if (!proIds.length) return map;
  const rows = await db.select().from(workingHours).where(inArray(workingHours.professionalId, proIds));
  for (const r of rows) {
    const list = map.get(r.professionalId) ?? [];
    list.push(r);
    map.set(r.professionalId, list);
  }
  return map;
}

/** Intervalos ocupados (agendamentos ativos + folgas/bloqueios) por profissional. */
export async function loadBusy(
  proIds: string[],
  from: Date,
  to: Date,
  opts: { excludeBookingId?: string } = {},
  conn?: Conn,
): Promise<Map<string, Busy[]>> {
  const db = conn ?? (await getDb());
  const map = new Map<string, Busy[]>(proIds.map((id) => [id, []]));
  if (!proIds.length) return map;

  const bks = await db
    .select({ pro: bookings.professionalId, start: bookings.startsAt, end: bookings.blockEndsAt, id: bookings.id })
    .from(bookings)
    .where(
      and(
        inArray(bookings.professionalId, proIds),
        inArray(bookings.status, BLOCKING_STATUSES),
        lt(bookings.startsAt, to),
        gt(bookings.blockEndsAt, from),
        // reservas temporárias vencidas não bloqueiam (mesmo antes da limpeza)
        or(sql`${bookings.status} <> 'pending_payment'`, gt(bookings.holdExpiresAt, new Date())),
      ),
    );
  for (const b of bks) {
    if (b.id === opts.excludeBookingId) continue;
    map.get(b.pro)?.push({ start: b.start, end: b.end });
  }

  const offs = await db
    .select()
    .from(timeOff)
    .where(
      and(
        or(inArray(timeOff.professionalId, proIds), isNull(timeOff.professionalId)),
        lt(timeOff.startsAt, to),
        gt(timeOff.endsAt, from),
      ),
    );
  for (const o of offs) {
    const range = { start: o.startsAt, end: o.endsAt };
    if (o.professionalId) map.get(o.professionalId)?.push(range);
    else for (const id of proIds) map.get(id)?.push(range);
  }
  return map;
}

export function bookingWindow(settings: StudioSettings, now = new Date()) {
  const first = todayYmd(now);
  const last = addDaysYmd(first, settings.maxDaysAhead);
  const earliest = new Date(now.getTime() + settings.minNoticeHours * 3_600_000);
  return { first, last, earliest };
}

export type DaySlot = { startMin: number; label: string; professionalIds: string[] };

/**
 * Horários disponíveis num dia para um serviço.
 * professionalId = "any" agrega todas as profissionais habilitadas.
 */
export async function getDaySlots(params: {
  serviceId: string;
  professionalId: string | "any";
  ymd: string;
  settings: StudioSettings;
  now?: Date;
  excludeBookingId?: string;
}): Promise<DaySlot[]> {
  const { serviceId, professionalId, ymd, settings } = params;
  const now = params.now ?? new Date();
  const { first, last, earliest } = bookingWindow(settings, now);
  if (ymd < first || ymd > last) return [];

  const svc = await getBookableService(serviceId);
  if (!svc) return [];
  let pros = await eligibleProfessionals(serviceId);
  if (professionalId !== "any") pros = pros.filter((p) => p.id === professionalId);
  else if (!settings.allowAnyProfessional) return [];
  if (!pros.length) return [];

  const ids = pros.map((p) => p.id);
  const dayStart = zonedToDate(ymd, 0);
  const dayEnd = zonedToDate(addDaysYmd(ymd, 1), 0);
  const [hours, busy] = await Promise.all([
    loadHours(ids),
    loadBusy(ids, new Date(dayStart.getTime() - 86_400_000), new Date(dayEnd.getTime() + 86_400_000), {
      excludeBookingId: params.excludeBookingId,
    }),
  ]);

  const bySlot = new Map<number, string[]>();
  for (const id of ids) {
    const slots = computeSlots({
      ymd,
      durationMin: svc.durationMin,
      bufferMin: svc.bufferMin,
      hours: hoursForDate(hours.get(id) ?? [], ymd),
      busy: busy.get(id) ?? [],
      stepMin: settings.slotIntervalMin,
      earliest,
    });
    for (const m of slots) bySlot.set(m, [...(bySlot.get(m) ?? []), id]);
  }
  return [...bySlot.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([startMin, professionalIds]) => ({ startMin, label: hhmm(startMin), professionalIds }));
}

/** Para o calendário: quais dias do intervalo possuem ao menos um horário livre. */
export async function getAvailableDates(params: {
  serviceId: string;
  professionalId: string | "any";
  fromYmd: string;
  toYmd: string;
  settings: StudioSettings;
  now?: Date;
}): Promise<string[]> {
  const { serviceId, professionalId, settings } = params;
  const now = params.now ?? new Date();
  const win = bookingWindow(settings, now);
  const from = params.fromYmd < win.first ? win.first : params.fromYmd;
  const to = params.toYmd > win.last ? win.last : params.toYmd;
  if (from > to) return [];

  const svc = await getBookableService(serviceId);
  if (!svc) return [];
  let pros = await eligibleProfessionals(serviceId);
  if (professionalId !== "any") pros = pros.filter((p) => p.id === professionalId);
  else if (!settings.allowAnyProfessional) return [];
  if (!pros.length) return [];

  const ids = pros.map((p) => p.id);
  const [hours, busy] = await Promise.all([
    loadHours(ids),
    loadBusy(ids, zonedToDate(addDaysYmd(from, -1), 0), zonedToDate(addDaysYmd(to, 2), 0)),
  ]);

  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysYmd(d, 1)) {
    const ok = ids.some(
      (id) =>
        computeSlots({
          ymd: d,
          durationMin: svc.durationMin,
          bufferMin: svc.bufferMin,
          hours: hoursForDate(hours.get(id) ?? [], d),
          busy: busy.get(id) ?? [],
          stepMin: settings.slotIntervalMin,
          earliest: win.earliest,
        }).length > 0,
    );
    if (ok) out.push(d);
  }
  return out;
}
