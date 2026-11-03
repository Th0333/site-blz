import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { webhookEvents } from "@/db/schema";
import { getMpConfig, logIntegrationError, markWebhookReceived, syncFromPaymentId, syncOrder, verifyWebhookSignature } from "@/server/mercadopago";

/**
 * Notificações do Mercado Pago (Webhooks).
 * 1) Valida a assinatura x-signature com a "assinatura secreta" da aplicação.
 * 2) Deduplica pelo x-request-id.
 * 3) NUNCA confia no corpo: consulta o pedido na API oficial e só então atualiza o status.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  let body: { type?: string; topic?: string; action?: string; data?: { id?: string }; id?: string | number } = {};
  try {
    body = await req.json();
  } catch {
    /* algumas notificações chegam sem corpo */
  }
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body.type ?? body.topic ?? "";
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("data_id") ?? url.searchParams.get("id") ?? body.data?.id ?? null;

  const cfg = await getMpConfig();
  if (!cfg.accessToken) return Response.json({ ok: false, error: "integration_not_configured" }, { status: 503 });

  let signatureValid = false;
  if (cfg.webhookSecret) {
    signatureValid = verifyWebhookSignature({ xSignature, xRequestId, dataId, secret: cfg.webhookSecret });
    if (!signatureValid) {
      await logIntegrationError("webhook_signature", `Assinatura inválida para notificação ${type}:${dataId ?? "?"}`);
      return Response.json({ ok: false, error: "invalid_signature" }, { status: 401 });
    }
  }

  const db = await getDb();
  const eventKey = xRequestId ?? `${type}:${dataId}:${body.action ?? ""}:${body.id ?? ""}`;
  const [inserted] = await db
    .insert(webhookEvents)
    .values({ provider: "mercadopago", eventKey, topic: type, action: body.action ?? null, resourceId: dataId, signatureValid, status: "received" })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });

  if (!inserted) {
    const [prev] = await db.select().from(webhookEvents).where(and(eq(webhookEvents.provider, "mercadopago"), eq(webhookEvents.eventKey, eventKey)));
    // Já processada: confirma sem reprocessar (idempotência)
    if (prev?.status === "processed" || prev?.status === "ignored") return Response.json({ ok: true, duplicate: true });
  }
  const eventId = inserted?.id;
  await markWebhookReceived();

  try {
    let status: "processed" | "ignored" = "processed";
    if (!dataId) status = "ignored";
    else if (type === "order") await syncOrder(dataId);
    else if (type === "payment") await syncFromPaymentId(dataId);
    else status = "ignored";
    if (eventId) await db.update(webhookEvents).set({ status, processedAt: new Date() }).where(eq(webhookEvents.id, eventId));
    return Response.json({ ok: true });
  } catch (err) {
    const message = (err as Error).message;
    await logIntegrationError("webhook_process", message);
    if (eventId) await db.update(webhookEvents).set({ status: "error", error: message.slice(0, 300) }).where(eq(webhookEvents.id, eventId));
    // 500 faz o Mercado Pago tentar novamente mais tarde
    return Response.json({ ok: false }, { status: 500 });
  }
}

export function GET() {
  return Response.json({ ok: true, info: "Endpoint de notificações do Mercado Pago. Use POST." });
}
