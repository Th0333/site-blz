"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, payments, user } from "@/db/schema";
import { requireAdmin } from "@/server/session";
import { cancelBooking, checkInBooking, createBooking, rescheduleBooking, setAttendanceStatus } from "@/server/bookings";
import { refundManualPayment, registerInPersonPayment, resolvePaymentReview, IN_PERSON_METHODS } from "@/server/payments";
import { refundOrder, syncOrder } from "@/server/mercadopago";
import { BusinessError, toResult } from "@/server/errors";
import { audit } from "@/server/events";
import { parseBRL } from "@/lib/money";
import { isValidYmd, parseHhmm, zonedToDate } from "@/lib/time";

const uuid = z.string().uuid();
const done = (id?: string) => {
  revalidatePath("/admin", "layout");
  if (id) revalidatePath(`/admin/agendamentos/${id}`);
};

export async function setStatusAction(id: string, status: "confirmed" | "completed" | "no_show" | "scheduled") {
  return toResult(async () => {
    const admin = await requireAdmin();
    await setAttendanceStatus(uuid.parse(id), z.enum(["confirmed", "completed", "no_show", "scheduled"]).parse(status), admin.id);
    done(id);
  });
}

export async function checkInAction(id: string) {
  return toResult(async () => {
    const admin = await requireAdmin();
    await checkInBooking(uuid.parse(id), admin.id);
    done(id);
  });
}

export async function cancelAction(id: string, reason: string) {
  return toResult(async () => {
    const admin = await requireAdmin();
    await cancelBooking({ bookingId: uuid.parse(id), actor: { id: admin.id, isAdmin: true }, reason });
    done(id);
  });
}

export async function rescheduleAction(id: string, ymd: string, time: string, professionalId?: string) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const startMin = parseHhmm(time);
    if (startMin === null || !isValidYmd(ymd)) throw new BusinessError("Data ou horário inválido.");
    await rescheduleBooking({ bookingId: uuid.parse(id), ymd, startMin, professionalId: professionalId || undefined, actor: { id: admin.id, isAdmin: true } });
    done(id);
  });
}

export async function registerPaymentAction(id: string, input: { amount: string; method: string; paidDate: string; paidTime: string; notes?: string }) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const amountCents = parseBRL(input.amount);
    if (amountCents === null) throw new BusinessError("Valor inválido.");
    const mins = parseHhmm(input.paidTime || "12:00");
    if (!isValidYmd(input.paidDate) || mins === null) throw new BusinessError("Data do recebimento inválida.");
    await registerInPersonPayment({
      bookingId: uuid.parse(id),
      amountCents,
      method: z.enum(Object.keys(IN_PERSON_METHODS) as [keyof typeof IN_PERSON_METHODS]).parse(input.method),
      paidAt: zonedToDate(input.paidDate, mins),
      notes: input.notes,
      actorId: admin.id,
    });
    done(id);
  });
}

export async function refundAction(paymentId: string, notes: string) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    const [p] = await db.select().from(payments).where(eq(payments.id, uuid.parse(paymentId)));
    if (!p) throw new BusinessError("Pagamento não encontrado.");
    if (p.provider === "manual") await refundManualPayment(p.id, admin.id, notes);
    else {
      if (!p.providerOrderId) throw new BusinessError("Pagamento sem pedido no Mercado Pago.");
      await refundOrder(p.providerOrderId);
      await audit(admin.id, "payment.refund_requested", "payment", p.id, { notes });
    }
    done(p.bookingId);
  });
}

export async function syncPaymentAction(paymentId: string) {
  return toResult(async () => {
    await requireAdmin();
    const db = await getDb();
    const [p] = await db.select().from(payments).where(eq(payments.id, uuid.parse(paymentId)));
    if (!p?.providerOrderId) throw new BusinessError("Nada a sincronizar.");
    const r = await syncOrder(p.providerOrderId);
    done(p.bookingId);
    return { result: String(r) };
  });
}

export async function resolveReviewAction(paymentId: string, note: string) {
  return toResult(async () => {
    const admin = await requireAdmin();
    if (note.trim().length < 3) throw new BusinessError("Descreva brevemente como a divergência foi resolvida.");
    await resolvePaymentReview(uuid.parse(paymentId), admin.id, note.trim());
    done();
  });
}

export async function saveAdminNotesAction(id: string, notes: string) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    await db.update(bookings).set({ adminNotes: notes.slice(0, 2000) || null, updatedAt: new Date() }).where(eq(bookings.id, uuid.parse(id)));
    await audit(admin.id, "booking.notes", "booking", id);
    done(id);
  });
}

/** Reserva online ainda não paga → passa a ser "pagar no dia" (ex.: cliente combinou pelo WhatsApp). */
export async function convertToInPersonAction(id: string) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    const [b] = await db
      .update(bookings)
      .set({ paymentMethod: "in_person", status: "scheduled", holdExpiresAt: null, updatedAt: new Date() })
      .where(and(eq(bookings.id, uuid.parse(id)), eq(bookings.status, "pending_payment")))
      .returning({ id: bookings.id });
    if (!b) throw new BusinessError("Somente reservas aguardando pagamento podem ser convertidas.");
    await audit(admin.id, "booking.convert_in_person", "booking", id);
    done(id);
  });
}

const manualSchema = z.object({
  clientId: z.string().optional(),
  newClient: z.object({ name: z.string().trim().min(3), email: z.string().trim().email(), phone: z.string().trim().min(10) }).optional(),
  serviceId: uuid,
  professionalId: uuid,
  date: z.string(),
  time: z.string(),
  notes: z.string().max(1000).optional(),
});

/** Agendamento manual (balcão/WhatsApp). Respeita sobreposição; permite encaixe fora da jornada. */
export async function createManualBookingAction(input: z.infer<typeof manualSchema>) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const d = manualSchema.parse(input);
    const startMin = parseHhmm(d.time);
    if (startMin === null || !isValidYmd(d.date)) throw new BusinessError("Data ou horário inválido.");
    const db = await getDb();
    let clientId = d.clientId;
    if (!clientId && d.newClient) {
      const email = d.newClient.email.toLowerCase();
      const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
      if (existing) clientId = existing.id;
      else {
        // Cliente sem senha: poderá definir uma pelo "Esqueci minha senha"
        clientId = randomUUID();
        await db.insert(user).values({ id: clientId, name: d.newClient.name, email, phone: d.newClient.phone.replace(/\D/g, ""), role: "client" });
        await audit(admin.id, "client.create_manual", "user", clientId);
      }
    }
    if (!clientId) throw new BusinessError("Selecione ou cadastre a cliente.");
    const b = await createBooking({
      clientId,
      serviceId: d.serviceId,
      professionalId: d.professionalId,
      ymd: d.date,
      startMin,
      paymentMethod: "in_person",
      clientNotes: d.notes,
      actor: { id: admin.id, isAdmin: true },
    });
    done();
    return { id: b.id };
  });
}
