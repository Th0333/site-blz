/**
 * Integração Mercado Pago com a API simulada (fetch interceptado):
 * valida o pedido enviado ao criar o checkout e a sincronização pelo webhook.
 * O teste real em sandbox depende das credenciais da proprietária (ver docs/TESTES.md).
 */
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { bookings, financialEntries, payments, webhookEvents } from "@/db/schema";
import { createBooking } from "@/server/bookings";
import { saveCredentials, startCheckout, syncBookingPayments } from "@/server/mercadopago";
import { addDaysYmd, todayYmd } from "@/lib/time";
import { POST as webhook } from "@/app/api/webhooks/mercadopago/route";
import { freshDb, makePro, makeService, makeUser } from "./helpers";

let db: DB;
const SECRET = "assinatura-secreta-teste";
type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
let orderState: Record<string, unknown>;

function mockFetch() {
  calls = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    if (url.endsWith("/v1/orders") && init.method === "POST") {
      const body = JSON.parse(String(init.body));
      orderState = { id: "ORD01TESTE", status: "created", external_reference: body.external_reference, total_amount: body.total_amount, currency: "BRL" };
      return new Response(JSON.stringify({ ...orderState, checkout_url: "https://www.mercadopago.com.br/checkout/v1/redirect?order_id=ORD01TESTE" }), { status: 201 });
    }
    if (url.includes("/v1/orders/ORD01TESTE")) return new Response(JSON.stringify(orderState), { status: 200 });
    return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
  });
}

async function setup(price = 25000) {
  db = await freshDb({ holdMinutes: 30 });
  await saveCredentials({ environment: "test", publicKey: "TEST-public", accessToken: "TEST-1234567890-abcdefghijklmnopqrstuvwxyz", webhookSecret: SECRET }, null as unknown as string);
  const pro = await makePro(db);
  const svc = await makeService(db, [pro.id], { priceCents: price });
  const client = await makeUser(db);
  const b = await createBooking({ clientId: client, serviceId: svc.id, professionalId: pro.id, ymd: addDaysYmd(todayYmd(), 2), startMin: 600, paymentMethod: "online" });
  return { b, client };
}

function signedRequest(dataId: string, requestId: string, secret = SECRET) {
  const ts = String(Date.now());
  const v1 = createHmac("sha256", secret).update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`).digest("hex");
  return new Request(`http://localhost:3000/api/webhooks/mercadopago?data.id=${dataId}&type=order`, {
    method: "POST",
    headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId, "content-type": "application/json" },
    body: JSON.stringify({ type: "order", action: "order.processed", data: { id: dataId } }),
  });
}

beforeEach(() => mockFetch());
afterEach(() => vi.unstubAllGlobals());

describe("Checkout Pro (Orders API)", () => {
  it("cria o pedido no backend com valor do agendamento, referência e chave de idempotência", async () => {
    const { b, client } = await setup(25000);
    const url = await startCheckout(b.id, client);
    expect(url).toContain("mercadopago.com.br/checkout");
    const call = calls.find((c) => c.url.endsWith("/v1/orders"))!;
    const headers = call.init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Bearer TEST-/);
    expect(headers["X-Idempotency-Key"]).toBeTruthy();
    const body = JSON.parse(String(call.init.body));
    expect(body).toMatchObject({ type: "online", processing_mode: "manual", total_amount: "250.00", external_reference: b.id });
    expect(body.items[0].unit_price).toBe("250.00");
    expect(body.config.online.success_url).toContain(`agendamento=${b.id}`);
    // nova tentativa reaproveita o checkout aberto (sem novo pedido nem nova reserva)
    await startCheckout(b.id, client);
    expect(calls.filter((c) => c.url.endsWith("/v1/orders")).length).toBe(1);
    expect(await db.select().from(bookings)).toHaveLength(1);
  });

  it("não permite pagar reserva de outra cliente", async () => {
    const { b } = await setup();
    const other = await makeUser(db);
    await expect(startCheckout(b.id, other)).rejects.toThrow(/não encontrado/);
  });

  it("webhook com assinatura válida confirma via API e é idempotente", async () => {
    const { b, client } = await setup(25000);
    await startCheckout(b.id, client);
    orderState = { ...orderState, status: "processed", total_paid_amount: "250.00", transactions: { payments: [{ id: "PAY01X", status: "processed", status_detail: "accredited", amount: "250.00", paid_amount: "250.00", payment_method: { id: "pix", type: "bank_transfer" } }] } };

    const r1 = await webhook(signedRequest("ORD01TESTE", "req-1"));
    expect(r1.status).toBe(200);
    const r2 = await webhook(signedRequest("ORD01TESTE", "req-1")); // mesma notificação repetida
    expect((await r2.json()).duplicate).toBe(true);
    const r3 = await webhook(signedRequest("ORD01TESTE", "req-2")); // nova notificação, mesmo status
    expect(r3.status).toBe(200);

    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after.status).toBe("confirmed");
    expect(after.paymentStatus).toBe("paid");
    expect(await db.select().from(financialEntries)).toHaveLength(1);
    const [p] = await db.select().from(payments).where(eq(payments.bookingId, b.id));
    expect(p.providerPaymentId).toBe("PAY01X");
    expect(await db.select().from(webhookEvents)).toHaveLength(2);
  });

  it("webhook com assinatura inválida é rejeitado e não altera nada", async () => {
    const { b, client } = await setup();
    await startCheckout(b.id, client);
    orderState = { ...orderState, status: "processed", transactions: { payments: [{ id: "P", status: "processed", status_detail: "accredited", amount: "250.00", paid_amount: "250.00" }] } };
    const res = await webhook(signedRequest("ORD01TESTE", "req-x", "segredo-errado"));
    expect(res.status).toBe(401);
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after.paymentStatus).toBe("pending");
    expect(await db.select().from(financialEntries)).toHaveLength(0);
  });

  it("retorno do checkout consulta a API (não confia na URL) — recusado não gera receita", async () => {
    const { b, client } = await setup();
    await startCheckout(b.id, client);
    orderState = { ...orderState, status: "failed", transactions: { payments: [{ id: "P", status: "failed", status_detail: "rejected_by_issuer", amount: "250.00" }] } };
    await syncBookingPayments(b.id);
    const [p] = await db.select().from(payments).where(eq(payments.bookingId, b.id));
    expect(p.status).toBe("rejected");
    expect(await db.select().from(financialEntries)).toHaveLength(0);
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after.status).toBe("pending_payment");
  });
});
