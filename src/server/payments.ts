import { randomUUID } from "node:crypto";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { getDb, type Tx } from "@/db";
import { bookings, financialEntries, paymentIntegration, payments, type PaymentTxStatus } from "@/db/schema";
import { formatBRL } from "@/lib/money";
import { fmtDate, fmtTime } from "@/lib/time";
import { BusinessError, isOverlapError, isUniqueError } from "./errors";
import { audit, emitEvent } from "./events";

export const IN_PERSON_METHODS = {
  pix: "Pix",
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  bank_transfer: "Transferência",
  other: "Outro",
} as const;

export type ProviderSnapshot = {
  providerOrderId: string;
  providerPaymentId: string | null;
  status: Exclude<PaymentTxStatus, never>;
  statusDetail: string | null;
  externalReference: string | null;
  totalAmountCents: number | null;
  paidAmountCents: number | null;
  currency: string;
  method: string | null;
  environment: "test" | "production";
  feeCents?: number | null;
};

type PendingEvent = Parameters<typeof emitEvent>[0];

async function forUpdatePayment(tx: Tx, orderId: string) {
  const [p] = await tx.select().from(payments).where(eq(payments.providerOrderId, orderId)).for("update");
  return p;
}

/**
 * Aplica um status confirmado pela API do Mercado Pago. Idempotente:
 * notificações repetidas não duplicam receita (constraint única por pagamento/tipo).
 */
export async function applyProviderPayment(snap: ProviderSnapshot) {
  const db = await getDb();
  const pendingEvents: PendingEvent[] = [];

  const outcome = await db.transaction(async (tx) => {
    let local = await forUpdatePayment(tx, snap.providerOrderId);
    if (!local) {
      // Pedido sem registro local (ex.: resposta perdida na criação): só aceita se referenciar um agendamento real
      const ref = snap.externalReference;
      if (!ref || !/^[0-9a-f-]{36}$/i.test(ref)) return "ignored" as const;
      const [bk] = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, ref));
      if (!bk) return "ignored" as const;
      [local] = await tx
        .insert(payments)
        .values({
          bookingId: bk.id,
          provider: "mercadopago",
          status: "created",
          amountCents: snap.totalAmountCents ?? 1,
          providerOrderId: snap.providerOrderId,
          idempotencyKey: `order-${snap.providerOrderId}`,
          environment: snap.environment,
        })
        .returning();
    }
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, local.bookingId)).for("update");

    // Validação de referência, valor e moeda — divergências vão para revisão
    const problems: string[] = [];
    if (snap.externalReference && snap.externalReference !== booking.id) problems.push("referência do pedido não confere com o agendamento");
    if (snap.totalAmountCents != null && snap.totalAmountCents !== local.amountCents) problems.push(`valor do pedido (${formatBRL(snap.totalAmountCents)}) difere do cobrado (${formatBRL(local.amountCents)})`);
    if (snap.currency && snap.currency !== "BRL") problems.push(`moeda inesperada (${snap.currency})`);
    if (snap.status === "approved" && snap.paidAmountCents != null && snap.paidAmountCents < local.amountCents) problems.push("valor pago menor que o valor do agendamento");

    const prev = local.status;
    const base = {
      providerPaymentId: snap.providerPaymentId ?? local.providerPaymentId,
      statusDetail: snap.statusDetail,
      method: snap.method ?? local.method,
      paidAmountCents: snap.paidAmountCents ?? local.paidAmountCents,
      feeCents: snap.feeCents ?? local.feeCents,
      netCents: snap.feeCents != null && snap.paidAmountCents != null ? snap.paidAmountCents - snap.feeCents : local.netCents,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    };

    if (snap.status === "approved") {
      if (prev === "approved") {
        await tx.update(payments).set(base).where(eq(payments.id, local.id));
        return "unchanged" as const;
      }
      const paidAt = new Date();
      let reviewReason = problems.length ? problems.join("; ") : null;
      try {
        await tx.transaction((sp) => sp.update(payments).set({ ...base, status: "approved", paidAt, reviewReason }).where(eq(payments.id, local!.id)));
      } catch (err) {
        if (!isUniqueError(err)) throw err;
        reviewReason = "pagamento duplicado: o agendamento já possuía outro pagamento aprovado (avaliar reembolso)";
        await tx.update(payments).set({ ...base, status: "approved", paidAt, reviewReason }).where(eq(payments.id, local.id));
      }
      // Dinheiro efetivamente recebido entra no caixa (mesmo quando em revisão)
      await tx
        .insert(financialEntries)
        .values({
          paymentId: local.id,
          bookingId: booking.id,
          kind: "receipt",
          channel: "online",
          method: base.method,
          amountCents: base.paidAmountCents ?? local.amountCents,
          feeCents: base.feeCents,
          occurredAt: paidAt,
        })
        .onConflictDoNothing();

      let bookingPatch: Partial<typeof bookings.$inferInsert> = { paymentStatus: reviewReason ? "review" : "paid", updatedAt: new Date() };
      if (booking.status === "pending_payment") {
        bookingPatch = { ...bookingPatch, status: "confirmed", holdExpiresAt: null };
      } else if (booking.status === "expired") {
        // Pagamento chegou depois da expiração: só confirma se o horário ainda estiver livre
        try {
          await tx.transaction((sp) => sp.update(bookings).set({ status: "confirmed", holdExpiresAt: null }).where(eq(bookings.id, booking.id)));
        } catch (err) {
          if (!isOverlapError(err)) throw err;
          reviewReason = "pagamento aprovado após a expiração da reserva e o horário já foi ocupado — remarcar ou reembolsar";
          bookingPatch.paymentStatus = "review";
          await tx.update(payments).set({ reviewReason }).where(eq(payments.id, local.id));
        }
      } else if (booking.status === "cancelled") {
        reviewReason = "pagamento aprovado para um agendamento cancelado — avaliar reembolso";
        bookingPatch.paymentStatus = "review";
        await tx.update(payments).set({ reviewReason }).where(eq(payments.id, local.id));
      }
      await tx.update(bookings).set(bookingPatch).where(eq(bookings.id, booking.id));
      await tx
        .update(paymentIntegration)
        .set(snap.environment === "production" ? { lastApprovedLiveAt: paidAt } : { lastApprovedTestAt: paidAt })
        .where(eq(paymentIntegration.id, 1));
      await audit(null, "payment.approved", "payment", local.id, { orderId: snap.providerOrderId, review: reviewReason }, tx);

      pendingEvents.push(
        reviewReason
          ? { type: "payment.review", userId: booking.clientId, bookingId: booking.id, title: "Pagamento recebido — em análise", body: `Recebemos seu pagamento de ${formatBRL(base.paidAmountCents ?? local.amountCents)} referente ao agendamento ${booking.code}. Nossa equipe vai entrar em contato para finalizar os detalhes.`, email: true, ctaPath: "/minha-conta" }
          : { type: "payment.approved", userId: booking.clientId, bookingId: booking.id, title: "Pagamento aprovado", body: `Seu pagamento de ${formatBRL(base.paidAmountCents ?? local.amountCents)} foi aprovado. ${booking.serviceName} em ${fmtDate(booking.startsAt)} às ${fmtTime(booking.startsAt)} está confirmado. Código ${booking.code}.`, email: true, ctaPath: "/minha-conta" },
      );
      return reviewReason ? ("review" as const) : ("approved" as const);
    }

    if (snap.status === "refunded" || snap.status === "charged_back") {
      if (prev === snap.status) {
        await tx.update(payments).set(base).where(eq(payments.id, local.id));
        return "unchanged" as const;
      }
      await tx.update(payments).set({ ...base, status: snap.status }).where(eq(payments.id, local.id));
      const [receipt] = await tx
        .select()
        .from(financialEntries)
        .where(and(eq(financialEntries.paymentId, local.id), eq(financialEntries.kind, "receipt")));
      if (receipt) {
        await tx
          .insert(financialEntries)
          .values({ paymentId: local.id, bookingId: booking.id, kind: "refund", channel: "online", method: receipt.method, amountCents: -receipt.amountCents, occurredAt: new Date(), notes: snap.status === "charged_back" ? "Contestação (chargeback)" : null })
          .onConflictDoNothing();
      }
      await recomputeBookingPaymentStatus(tx, booking.id, "refunded");
      await audit(null, `payment.${snap.status}`, "payment", local.id, { orderId: snap.providerOrderId }, tx);
      pendingEvents.push({ type: "payment.refunded", userId: booking.clientId, bookingId: booking.id, title: "Pagamento estornado", body: `O pagamento do agendamento ${booking.code} foi estornado.`, email: true, ctaPath: "/minha-conta" });
      return "refunded" as const;
    }

    // rejected | cancelled | expired | pending | created
    if (["approved", "refunded", "charged_back"].includes(prev)) {
      // Regressão de status inesperada: não mexe no caixa, sinaliza para revisão
      await tx.update(payments).set({ ...base, reviewReason: `status inesperado do provedor (${snap.status}) após ${prev}` }).where(eq(payments.id, local.id));
      await tx.update(bookings).set({ paymentStatus: "review" }).where(eq(bookings.id, booking.id));
      return "review" as const;
    }
    await tx.update(payments).set({ ...base, status: snap.status, reviewReason: problems.length ? problems.join("; ") : null }).where(eq(payments.id, local.id));
    if (snap.status === "rejected" && prev !== "rejected") {
      pendingEvents.push({ type: "payment.rejected", userId: booking.clientId, bookingId: booking.id, title: "Pagamento não aprovado", body: `O pagamento do agendamento ${booking.code} não foi aprovado. ${booking.status === "pending_payment" ? "Seu horário continua reservado por alguns minutos: você pode tentar novamente com outro meio de pagamento." : ""}`, email: true, ctaPath: `/agendar/retorno?agendamento=${booking.id}` });
    }
    return snap.status;
  });

  for (const ev of pendingEvents) await emitEvent(ev);
  return outcome;
}

async function recomputeBookingPaymentStatus(tx: Tx, bookingId: string, fallback: "pending" | "refunded") {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(payments)
    .where(and(eq(payments.bookingId, bookingId), eq(payments.status, "approved"), isNull(payments.reviewReason)));
  await tx
    .update(bookings)
    .set({ paymentStatus: row.n > 0 ? "paid" : fallback, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));
}

/** Registro manual de pagamento presencial pela administradora. */
export async function registerInPersonPayment(input: {
  bookingId: string;
  amountCents: number;
  method: keyof typeof IN_PERSON_METHODS;
  paidAt: Date;
  notes?: string | null;
  actorId: string;
}) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new BusinessError("Informe um valor maior que zero.");
  if (!(input.method in IN_PERSON_METHODS)) throw new BusinessError("Forma de recebimento inválida.");
  if (input.paidAt.getTime() > Date.now() + 5 * 60_000) throw new BusinessError("A data do recebimento não pode estar no futuro.");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, input.bookingId)).for("update");
    if (!b) throw new BusinessError("Agendamento não encontrado.");
    if (b.status === "expired") throw new BusinessError("Esta reserva expirou; crie um novo agendamento.");
    const [existing] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.bookingId, b.id), eq(payments.status, "approved"), isNull(payments.reviewReason)));
    if (existing) throw new BusinessError("Este agendamento já possui um pagamento registrado.");

    try {
      const [p] = await tx.transaction((sp) =>
        sp
          .insert(payments)
          .values({
            bookingId: b.id,
            provider: "manual",
            method: input.method,
            status: "approved",
            amountCents: input.amountCents,
            paidAmountCents: input.amountCents,
            idempotencyKey: `manual-${randomUUID()}`,
            paidAt: input.paidAt,
            receivedBy: input.actorId,
            notes: input.notes?.slice(0, 1000) || null,
          })
          .returning(),
      );
      await tx.insert(financialEntries).values({
        paymentId: p.id,
        bookingId: b.id,
        kind: "receipt",
        channel: "in_person",
        method: input.method,
        amountCents: input.amountCents,
        occurredAt: input.paidAt,
        createdBy: input.actorId,
        notes: input.notes?.slice(0, 1000) || null,
      });
      await tx.update(bookings).set({ paymentStatus: "paid", updatedAt: new Date() }).where(eq(bookings.id, b.id));
      await audit(input.actorId, "payment.manual_register", "payment", p.id, { bookingId: b.id, amountCents: input.amountCents, method: input.method }, tx);
      return p;
    } catch (err) {
      if (isUniqueError(err)) throw new BusinessError("Este agendamento já possui um pagamento registrado.");
      throw err;
    }
  });
}

/** Estorno de pagamento manual (presencial). Pagamentos online são estornados via Mercado Pago. */
export async function refundManualPayment(paymentId: string, actorId: string, notes?: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!p || p.provider !== "manual") throw new BusinessError("Pagamento não encontrado.");
    if (p.status !== "approved") throw new BusinessError("Somente pagamentos recebidos podem ser estornados.");
    await tx.update(payments).set({ status: "refunded", notes: [p.notes, notes].filter(Boolean).join(" | ") || null, updatedAt: new Date() }).where(eq(payments.id, p.id));
    await tx
      .insert(financialEntries)
      .values({ paymentId: p.id, bookingId: p.bookingId, kind: "refund", channel: "in_person", method: p.method, amountCents: -(p.paidAmountCents ?? p.amountCents), occurredAt: new Date(), createdBy: actorId, notes: notes ?? null })
      .onConflictDoNothing();
    await recomputeBookingPaymentStatus(tx, p.bookingId, "refunded");
    await audit(actorId, "payment.manual_refund", "payment", p.id, { notes: notes ?? null }, tx);
  });
}

/** Marca uma divergência como resolvida (após análise da administradora). */
export async function resolvePaymentReview(paymentId: string, actorId: string, note: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!p || !p.reviewReason) throw new BusinessError("Nada a resolver neste pagamento.");
    await tx
      .update(payments)
      .set({ reviewResolvedAt: new Date(), notes: [p.notes, `Revisão: ${note}`].filter(Boolean).join(" | "), updatedAt: new Date() })
      .where(eq(payments.id, p.id));
    const [others] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(payments)
      .where(and(eq(payments.bookingId, p.bookingId), ne(payments.id, p.id), eq(payments.status, "approved")));
    const paid = p.status === "approved" || others.n > 0;
    await tx.update(bookings).set({ paymentStatus: paid ? "paid" : p.status === "refunded" ? "refunded" : "pending" }).where(eq(bookings.id, p.bookingId));
    await audit(actorId, "payment.review_resolved", "payment", p.id, { note }, tx);
  });
}
