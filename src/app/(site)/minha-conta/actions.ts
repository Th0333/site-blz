"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, events, session as sessionTable, account, testimonials, user } from "@/db/schema";
import { requireUser } from "@/server/session";
import { cancelBooking, rescheduleBooking } from "@/server/bookings";
import { BusinessError, toResult } from "@/server/errors";
import { audit } from "@/server/events";

export async function cancelMyBookingAction(bookingId: string, reason?: string) {
  return toResult(async () => {
    const u = await requireUser();
    await cancelBooking({ bookingId: z.string().uuid().parse(bookingId), actor: { id: u.id, isAdmin: false }, reason: reason?.slice(0, 300) });
    revalidatePath("/minha-conta");
  });
}

export async function rescheduleMyBookingAction(bookingId: string, ymd: string, startMin: number) {
  return toResult(async () => {
    const u = await requireUser();
    await rescheduleBooking({ bookingId: z.string().uuid().parse(bookingId), ymd: z.string().parse(ymd), startMin: z.number().int().parse(startMin), actor: { id: u.id, isAdmin: false } });
    revalidatePath("/minha-conta");
  });
}

const profileSchema = z.object({
  name: z.string().trim().min(3).max(120),
  phone: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().min(10).max(13)),
});

export async function updateProfileAction(input: z.infer<typeof profileSchema>) {
  return toResult(async () => {
    const u = await requireUser();
    const data = profileSchema.parse(input);
    const db = await getDb();
    await db.update(user).set({ name: data.name, phone: data.phone, updatedAt: new Date() }).where(eq(user.id, u.id));
    revalidatePath("/minha-conta");
  });
}

export async function submitTestimonialAction(bookingId: string, text: string, rating: number) {
  return toResult(async () => {
    const u = await requireUser();
    const clean = text.trim();
    if (clean.length < 10) throw new BusinessError("Conte um pouquinho mais (mínimo de 10 caracteres).");
    const db = await getDb();
    const [b] = await db.select().from(bookings).where(and(eq(bookings.id, z.string().uuid().parse(bookingId)), eq(bookings.clientId, u.id), eq(bookings.status, "completed")));
    if (!b) throw new BusinessError("Só é possível avaliar atendimentos concluídos.");
    const [exists] = await db.select({ id: testimonials.id }).from(testimonials).where(eq(testimonials.bookingId, b.id));
    if (exists) throw new BusinessError("Você já enviou um depoimento para este atendimento. Obrigada!");
    await db.insert(testimonials).values({
      authorName: u.name.split(" ").slice(0, 2).join(" "),
      authorUserId: u.id,
      bookingId: b.id,
      text: clean.slice(0, 800),
      rating: Math.min(5, Math.max(1, Math.round(rating))),
      serviceLabel: b.serviceName,
      approved: false, // publicação somente após aprovação da administradora
    });
    revalidatePath("/minha-conta");
  });
}

export async function markNotificationsReadAction() {
  return toResult(async () => {
    const u = await requireUser();
    const db = await getDb();
    await db.update(events).set({ readAt: new Date() }).where(and(eq(events.userId, u.id), isNull(events.readAt)));
    revalidatePath("/minha-conta");
  });
}

/**
 * Exclusão de conta (LGPD): anonimiza os dados pessoais e encerra o acesso.
 * Agendamentos passados são mantidos de forma anônima para obrigações fiscais/contábeis.
 */
export async function deleteMyAccountAction(confirmEmail: string) {
  return toResult(async () => {
    const u = await requireUser();
    if (u.role !== "client") throw new BusinessError("Contas da equipe são removidas pela administração.");
    if (confirmEmail.trim().toLowerCase() !== u.email.toLowerCase()) throw new BusinessError("O e-mail digitado não confere.");
    const db = await getDb();
    const [future] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.clientId, u.id), gt(bookings.startsAt, new Date()), inArray(bookings.status, ["pending_payment", "scheduled", "confirmed"])));
    if (future) throw new BusinessError("Você tem agendamentos futuros. Cancele-os antes de excluir a conta.");
    await db.transaction(async (tx) => {
      await tx.delete(sessionTable).where(eq(sessionTable.userId, u.id));
      await tx.delete(account).where(eq(account.userId, u.id));
      await tx.delete(events).where(eq(events.userId, u.id));
      await tx
        .update(user)
        .set({ name: "Cliente removida", email: `removida+${u.id}@anonimo.invalid`, phone: null, image: null, emailVerified: false, updatedAt: new Date() })
        .where(eq(user.id, u.id));
      await tx.update(testimonials).set({ authorUserId: null }).where(eq(testimonials.authorUserId, u.id));
    });
    await audit(null, "user.anonymized", "user", u.id);
  });
}
