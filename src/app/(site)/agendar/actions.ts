"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings } from "@/db/schema";
import { requireUser } from "@/server/session";
import { createBooking } from "@/server/bookings";
import { startCheckout } from "@/server/mercadopago";
import { getSettings } from "@/server/settings";
import { BusinessError, toResult } from "@/server/errors";
import { audit } from "@/server/events";

const schema = z.object({
  serviceId: z.string().uuid(),
  professionalId: z.union([z.literal("any"), z.string().uuid()]),
  ymd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMin: z.number().int().min(0).max(1439),
  paymentMethod: z.enum(["in_person", "online"]),
  notes: z.string().max(1000).optional(),
});

/** Cria o agendamento (preço e disponibilidade calculados/revalidados no servidor). */
export async function confirmBookingAction(input: z.infer<typeof schema>) {
  return toResult(async () => {
    const user = await requireUser();
    const data = schema.parse(input);
    const booking = await createBooking({
      clientId: user.id,
      serviceId: data.serviceId,
      professionalId: data.professionalId,
      ymd: data.ymd,
      startMin: data.startMin,
      paymentMethod: data.paymentMethod,
      clientNotes: data.notes,
    });
    if (data.paymentMethod === "online") {
      try {
        const url = await startCheckout(booking.id, user.id);
        return { bookingId: booking.id, checkoutUrl: url };
      } catch (err) {
        // Reserva criada, checkout falhou: a cliente pode tentar de novo na página de confirmação
        return { bookingId: booking.id, checkoutUrl: null, checkoutError: (err as Error).message };
      }
    }
    return { bookingId: booking.id, checkoutUrl: null };
  });
}

/** Nova tentativa de pagamento para a mesma reserva (sem duplicar agendamento). */
export async function retryCheckoutAction(bookingId: string) {
  return toResult(async () => {
    const user = await requireUser();
    return { checkoutUrl: await startCheckout(z.string().uuid().parse(bookingId), user.id) };
  });
}

/** Troca uma reserva online ainda não paga para pagamento no dia (se o estúdio permitir). */
export async function switchToInPersonAction(bookingId: string) {
  return toResult(async () => {
    const user = await requireUser();
    const s = await getSettings();
    if (!s.inPersonPaymentEnabled) throw new BusinessError("O pagamento no dia não está disponível.");
    const db = await getDb();
    const [b] = await db
      .update(bookings)
      .set({ paymentMethod: "in_person", status: "scheduled", holdExpiresAt: null, updatedAt: new Date() })
      .where(and(eq(bookings.id, z.string().uuid().parse(bookingId)), eq(bookings.clientId, user.id), eq(bookings.status, "pending_payment"), eq(bookings.paymentStatus, "pending")))
      .returning({ id: bookings.id });
    if (!b) throw new BusinessError("Não foi possível alterar: a reserva expirou ou já foi paga.");
    await audit(user.id, "booking.switch_in_person", "booking", b.id);
    return { bookingId: b.id };
  });
}
