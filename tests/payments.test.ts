import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { bookings, financialEntries, payments } from "@/db/schema";
import { createBooking } from "@/server/bookings";
import { applyProviderPayment, type ProviderSnapshot } from "@/server/payments";
import { mapOrderStatus, verifyWebhookSignature } from "@/server/mercadopago";
import { getFinanceSummary } from "@/server/finance";
import { addDaysYmd, todayYmd } from "@/lib/time";
import { freshDb, makePro, makeService, makeUser } from "./helpers";

let db: DB;
const day = () => addDaysYmd(todayYmd(), 2);

async function onlineBooking(priceCents = 30000, startMin = 600) {
  const pro = await makePro(db);
  const svc = await makeService(db, [pro.id], { priceCents });
  const client = await makeUser(db);
  const b = await createBooking({ clientId: client, serviceId: svc.id, professionalId: pro.id, ymd: day(), startMin, paymentMethod: "online" });
  const orderId = `ORD${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  await db.insert(payments).values({ bookingId: b.id, provider: "mercadopago", status: "created", amountCents: priceCents, providerOrderId: orderId, idempotencyKey: orderId, environment: "test" });
  return { b, orderId, pro, svc };
}

const snap = (orderId: string, bookingId: string, status: ProviderSnapshot["status"], amount = 30000): ProviderSnapshot => ({
  providerOrderId: orderId,
  providerPaymentId: "PAY01TEST",
  status,
  statusDetail: status === "approved" ? "accredited" : null,
  externalReference: bookingId,
  totalAmountCents: amount,
  paidAmountCents: status === "approved" ? amount : null,
  currency: "BRL",
  method: "credit_card",
  environment: "test",
});

beforeEach(async () => {
  db = await freshDb();
});

describe("pagamentos online", () => {
  it("aprovação confirma a reserva e é contabilizada uma única vez", async () => {
    const { b, orderId } = await onlineBooking();
    expect(await applyProviderPayment(snap(orderId, b.id, "approved"))).toBe("approved");
    expect(await applyProviderPayment(snap(orderId, b.id, "approved"))).toBe("unchanged");
    await Promise.all([1, 2, 3].map(() => applyProviderPayment(snap(orderId, b.id, "approved"))));
    const entries = await db.select().from(financialEntries);
    expect(entries).toHaveLength(1);
    expect(entries[0].amountCents).toBe(30000);
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after.status).toBe("confirmed");
    expect(after.paymentStatus).toBe("paid");
  });

  it("pagamento recusado não gera receita e mantém a reserva para nova tentativa", async () => {
    const { b, orderId } = await onlineBooking();
    expect(await applyProviderPayment(snap(orderId, b.id, "rejected"))).toBe("rejected");
    expect(await db.select().from(financialEntries)).toHaveLength(0);
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after.status).toBe("pending_payment");
    expect(after.paymentStatus).toBe("pending");
  });

  it("reembolso gera lançamento negativo e atualiza o agendamento", async () => {
    const { b, orderId } = await onlineBooking();
    await applyProviderPayment(snap(orderId, b.id, "approved"));
    await applyProviderPayment(snap(orderId, b.id, "refunded"));
    await applyProviderPayment(snap(orderId, b.id, "refunded"));
    const entries = await db.select().from(financialEntries);
    expect(entries.map((e) => e.amountCents).sort()).toEqual([-30000, 30000]);
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after.paymentStatus).toBe("refunded");
  });

  it("valor divergente é sinalizado para revisão", async () => {
    const { b, orderId } = await onlineBooking();
    const r = await applyProviderPayment(snap(orderId, b.id, "approved", 100));
    expect(r).toBe("review");
    const [p] = await db.select().from(payments).where(eq(payments.providerOrderId, orderId));
    expect(p.reviewReason).toMatch(/valor/);
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after.paymentStatus).toBe("review");
  });

  it("pagamento aprovado após expiração com horário ocupado vai para revisão", async () => {
    const { b, orderId, pro, svc } = await onlineBooking();
    await db.update(bookings).set({ status: "expired", paymentStatus: "not_charged" }).where(eq(bookings.id, b.id));
    await createBooking({ clientId: await makeUser(db), serviceId: svc.id, professionalId: pro.id, ymd: day(), startMin: 600, paymentMethod: "in_person" });
    expect(await applyProviderPayment(snap(orderId, b.id, "approved"))).toBe("review");
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after.status).toBe("expired");
    expect(after.paymentStatus).toBe("review");
  });

  it("pagamento aprovado após expiração com horário livre reativa a reserva", async () => {
    const { b, orderId } = await onlineBooking();
    await db.update(bookings).set({ status: "expired", paymentStatus: "not_charged" }).where(eq(bookings.id, b.id));
    expect(await applyProviderPayment(snap(orderId, b.id, "approved"))).toBe("approved");
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after.status).toBe("confirmed");
  });

  it("resumo financeiro separa recebido de pendente", async () => {
    const a = await onlineBooking(30000, 600);
    await applyProviderPayment(snap(a.orderId, a.b.id, "approved"));
    const c = await onlineBooking(12000, 780);
    await applyProviderPayment(snap(c.orderId, c.b.id, "rejected", 12000));
    const from = new Date(Date.now() - 86_400_000);
    const to = new Date(Date.now() + 5 * 86_400_000);
    const s = await getFinanceSummary({ from, to });
    expect(s.receivedCents).toBe(30000);
    expect(s.receivedOnlineCents).toBe(30000);
    expect(s.pendingCents).toBe(12000);
  });
});

describe("mapeamento e assinatura", () => {
  it("mapeia status do pedido", () => {
    expect(mapOrderStatus({ id: "1", status: "processed", transactions: { payments: [{ id: "p", status: "processed", status_detail: "accredited" }] } })).toBe("approved");
    expect(mapOrderStatus({ id: "1", status: "failed", transactions: { payments: [{ id: "p", status: "failed", status_detail: "rejected_by_issuer" }] } })).toBe("rejected");
    expect(mapOrderStatus({ id: "1", status: "action_required", transactions: { payments: [{ id: "p", status: "action_required", status_detail: "waiting_payment" }] } })).toBe("pending");
    expect(mapOrderStatus({ id: "1", status: "refunded", transactions: { payments: [{ id: "p", status: "refunded" }] } })).toBe("refunded");
    expect(mapOrderStatus({ id: "1", status: "created" })).toBe("created");
    expect(mapOrderStatus({ id: "1", status: "expired" })).toBe("expired");
  });

  it("valida a assinatura x-signature do webhook", () => {
    const secret = "segredo-de-teste";
    const ts = "1742505638683";
    const manifest = `id:ord01jq4s4ky8hwq6na5pxb65b3d3;request-id:abc-123;ts:${ts};`;
    const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
    const ok = verifyWebhookSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "abc-123", dataId: "ORD01JQ4S4KY8HWQ6NA5PXB65B3D3", secret });
    expect(ok).toBe(true);
    expect(verifyWebhookSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "outro", dataId: "ORD01JQ4S4KY8HWQ6NA5PXB65B3D3", secret })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: `ts=${ts},v1=${"0".repeat(64)}`, xRequestId: "abc-123", dataId: "x", secret })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: null, xRequestId: "abc-123", dataId: "x", secret })).toBe(false);
  });
});
