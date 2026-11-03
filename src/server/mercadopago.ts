/**
 * Integração oficial com o Mercado Pago — Checkout Pro via Orders API.
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/overview
 *
 * - O pedido (order) é criado no backend com valor calculado a partir do agendamento.
 * - O status só muda por consulta à API oficial (webhook, retorno ou sincronização),
 *   nunca pelos parâmetros da URL de retorno.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, integrationErrors, paymentIntegration, payments, user } from "@/db/schema";
import { decryptSecret, encryptSecret, hasEncryptionKey } from "@/lib/crypto";
import { appUrl, isHttps } from "@/lib/env";
import { centsToDecimal } from "@/lib/money";
import { BusinessError } from "./errors";
import { getSettings } from "./settings";
import { expireStaleHolds } from "./availability";
import { applyProviderPayment, type ProviderSnapshot } from "./payments";

const API = "https://api.mercadopago.com";

export type MpConfig = {
  accessToken: string | null;
  publicKey: string | null;
  webhookSecret: string | null;
  environment: "test" | "production";
  source: { accessToken: "env" | "db" | null; webhookSecret: "env" | "db" | null };
};

export async function getMpConfig(): Promise<MpConfig> {
  const db = await getDb();
  const [row] = await db.select().from(paymentIntegration).where(eq(paymentIntegration.id, 1));
  const dec = (v: string | null | undefined) => {
    if (!v || !hasEncryptionKey()) return null;
    try {
      return decryptSecret(v);
    } catch {
      return null;
    }
  };
  const envToken = process.env.MP_ACCESS_TOKEN || null;
  const envSecret = process.env.MP_WEBHOOK_SECRET || null;
  const dbToken = dec(row?.accessTokenEnc);
  const dbSecret = dec(row?.webhookSecretEnc);
  const envEnv = process.env.MP_ENVIRONMENT === "production" ? "production" : process.env.MP_ENVIRONMENT === "test" ? "test" : null;
  return {
    accessToken: envToken ?? dbToken,
    publicKey: process.env.MP_PUBLIC_KEY || row?.publicKey || null,
    webhookSecret: envSecret ?? dbSecret,
    environment: envEnv ?? row?.environment ?? "test",
    source: {
      accessToken: envToken ? "env" : dbToken ? "db" : null,
      webhookSecret: envSecret ? "env" : dbSecret ? "db" : null,
    },
  };
}

export async function logIntegrationError(context: string, message: string) {
  const db = await getDb();
  // Mensagens nunca incluem tokens; cortamos para evitar vazamento acidental de payloads
  await db.insert(integrationErrors).values({ provider: "mercadopago", context, message: message.slice(0, 500) });
}

class MpHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function mpFetch<T>(path: string, init: RequestInit & { token: string; idempotencyKey?: string }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${init.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* resposta não-JSON */
  }
  if (!res.ok) {
    const j = json as { message?: string; errors?: Array<{ message?: string; code?: string }> } | null;
    const msg = j?.errors?.map((e) => e.message ?? e.code).join("; ") || j?.message || `HTTP ${res.status}`;
    throw new MpHttpError(res.status, msg);
  }
  return json as T;
}

/* ------------------------------------------------------------------ */
/* Teste de conexão                                                    */
/* ------------------------------------------------------------------ */

export type ConnectionCheck = {
  status: "ok" | "incomplete" | "invalid_credentials" | "communication_error";
  environment: "test" | "production";
  message: string;
  nickname?: string;
  siteId?: string;
};

export async function testConnection(actorId: string): Promise<ConnectionCheck> {
  const cfg = await getMpConfig();
  const db = await getDb();
  let result: ConnectionCheck;
  if (!cfg.accessToken) {
    result = { status: "incomplete", environment: cfg.environment, message: "Access Token não configurado." };
  } else {
    try {
      const me = await mpFetch<{ id: number; nickname?: string; site_id?: string; tags?: string[] }>("/users/me", {
        method: "GET",
        token: cfg.accessToken,
      });
      const missing: string[] = [];
      if (!cfg.publicKey) missing.push("Public Key");
      if (!cfg.webhookSecret) missing.push("assinatura secreta do webhook");
      const isTestUser = (me.tags ?? []).includes("test_user") || cfg.accessToken.startsWith("TEST-");
      const envNote =
        cfg.environment === "production" && isTestUser
          ? " Atenção: o ambiente está marcado como produção, mas a credencial é de teste."
          : cfg.environment === "test" && !isTestUser
            ? " Atenção: o ambiente está marcado como teste, mas a credencial parece ser de produção."
            : "";
      result = {
        status: missing.length ? "incomplete" : "ok",
        environment: cfg.environment,
        nickname: me.nickname,
        siteId: me.site_id,
        message:
          (missing.length
            ? `Credencial válida (conta ${me.nickname ?? me.id}), mas falta configurar: ${missing.join(", ")}.`
            : `Conexão validada com a conta ${me.nickname ?? me.id} (${me.site_id ?? "—"}).`) + envNote,
      };
      if (me.site_id && me.site_id !== "MLB") {
        result.message += " A conta não é do Brasil (MLB); cobranças em BRL podem falhar.";
      }
    } catch (err) {
      if (err instanceof MpHttpError && (err.status === 401 || err.status === 403)) {
        result = { status: "invalid_credentials", environment: cfg.environment, message: "O Mercado Pago recusou o Access Token (credencial inválida ou revogada)." };
      } else {
        result = { status: "communication_error", environment: cfg.environment, message: `Não foi possível falar com o Mercado Pago: ${(err as Error).message}` };
        await logIntegrationError("test_connection", (err as Error).message);
      }
    }
  }
  await db
    .insert(paymentIntegration)
    .values({ id: 1, lastCheckAt: new Date(), lastCheckStatus: result.status, lastCheckMessage: result.message, accountNickname: result.nickname ?? null, accountSiteId: result.siteId ?? null, updatedBy: actorId })
    .onConflictDoUpdate({
      target: paymentIntegration.id,
      set: { lastCheckAt: new Date(), lastCheckStatus: result.status, lastCheckMessage: result.message, accountNickname: result.nickname ?? null, accountSiteId: result.siteId ?? null, updatedBy: actorId },
    });
  return result;
}

export async function saveCredentials(
  input: { environment: "test" | "production"; publicKey?: string | null; accessToken?: string | null; webhookSecret?: string | null },
  actorId: string,
) {
  if ((input.accessToken || input.webhookSecret) && !hasEncryptionKey())
    throw new BusinessError("Defina APP_ENCRYPTION_KEY no servidor antes de salvar credenciais pelo painel.");
  const db = await getDb();
  const set: Partial<typeof paymentIntegration.$inferInsert> = {
    environment: input.environment,
    updatedAt: new Date(),
    updatedBy: actorId,
    lastCheckStatus: null,
    lastCheckMessage: "Credenciais alteradas — execute o teste novamente.",
  };
  if (input.publicKey !== undefined) set.publicKey = input.publicKey?.trim() || null;
  if (input.accessToken) {
    const t = input.accessToken.trim();
    if (!/^(APP_USR|TEST)-[\w-]{20,}$/.test(t)) throw new BusinessError("O Access Token não parece válido (deve começar com APP_USR- ou TEST-).");
    set.accessTokenEnc = encryptSecret(t);
    set.accessTokenLast4 = t.slice(-4);
  }
  if (input.webhookSecret) set.webhookSecretEnc = encryptSecret(input.webhookSecret.trim());
  await db.insert(paymentIntegration).values({ id: 1, ...set }).onConflictDoUpdate({ target: paymentIntegration.id, set });
}

export async function clearCredentials(actorId: string) {
  const db = await getDb();
  await db
    .update(paymentIntegration)
    .set({ accessTokenEnc: null, accessTokenLast4: null, webhookSecretEnc: null, publicKey: null, lastCheckStatus: null, lastCheckMessage: "Credenciais removidas.", updatedAt: new Date(), updatedBy: actorId })
    .where(eq(paymentIntegration.id, 1));
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

type MpOrder = {
  id: string;
  status: string;
  status_detail?: string;
  external_reference?: string;
  total_amount?: string;
  total_paid_amount?: string;
  currency?: string;
  checkout_url?: string;
  transactions?: {
    payments?: Array<{
      id: string;
      status: string;
      status_detail?: string;
      amount?: string;
      paid_amount?: string;
      payment_method?: { id?: string; type?: string };
    }>;
    refunds?: Array<{ id: string; status?: string; amount?: string }>;
  };
};

/**
 * Cria (ou reaproveita) a tentativa de pagamento online de um agendamento e retorna a URL do checkout.
 * Nunca cria uma nova reserva — repetir após falha reutiliza o mesmo agendamento.
 */
export async function startCheckout(bookingId: string, userId: string): Promise<string> {
  const db = await getDb();
  const settings = await getSettings();
  if (!settings.onlinePaymentEnabled) throw new BusinessError("O pagamento online está desativado no momento.");
  const cfg = await getMpConfig();
  if (!cfg.accessToken) throw new BusinessError("O pagamento online ainda não foi configurado pelo estúdio.");

  await expireStaleHolds();
  const [row] = await db
    .select({ b: bookings, email: user.email, name: user.name })
    .from(bookings)
    .innerJoin(user, eq(user.id, bookings.clientId))
    .where(eq(bookings.id, bookingId));
  if (!row || row.b.clientId !== userId) throw new BusinessError("Agendamento não encontrado.");
  const b = row.b;
  if (b.paymentStatus === "paid") throw new BusinessError("Este agendamento já está pago.");
  if (b.paymentMethod !== "online") throw new BusinessError("Este agendamento foi reservado para pagamento no dia.");
  if (b.status !== "pending_payment" || !b.holdExpiresAt || b.holdExpiresAt.getTime() <= Date.now())
    throw new BusinessError("O prazo desta reserva expirou. Faça um novo agendamento para garantir o horário.", "hold_expired");

  const attempts = await db.select().from(payments).where(eq(payments.bookingId, b.id)).orderBy(desc(payments.createdAt));
  if (attempts.some((p) => p.status === "approved")) throw new BusinessError("Este agendamento já está pago.");
  if (attempts.some((p) => p.status === "pending"))
    throw new BusinessError("Há um pagamento em processamento para este agendamento (ex.: Pix aguardando confirmação). Aguarde alguns minutos.");

  // Reaproveita a última tentativa ainda aberta (mesmo valor) para não gerar cobranças paralelas
  const open = attempts.find(
    (p) => p.status === "created" && p.checkoutUrl && p.amountCents === b.priceCents && Date.now() - p.createdAt.getTime() < 20 * 60_000,
  );
  if (open?.checkoutUrl) return open.checkoutUrl;

  const remainingMin = Math.max(5, Math.floor((b.holdExpiresAt.getTime() - Date.now()) / 60_000));
  const idempotencyKey = randomUUID();
  const [attempt] = await db
    .insert(payments)
    .values({ bookingId: b.id, provider: "mercadopago", status: "created", amountCents: b.priceCents, environment: cfg.environment, idempotencyKey })
    .returning();

  const back = `${appUrl()}/agendar/retorno?agendamento=${b.id}`;
  const body = {
    type: "online",
    processing_mode: "manual",
    total_amount: centsToDecimal(b.priceCents),
    external_reference: b.id,
    description: `${b.serviceName} — ${settings.studioName}`.slice(0, 150),
    expiration_time: `PT${remainingMin}M`,
    payer: { email: row.email, first_name: row.name.split(" ")[0]?.slice(0, 60) },
    items: [
      {
        external_code: b.serviceId ?? b.id,
        title: b.serviceName.slice(0, 120),
        description: `Agendamento ${b.code}`,
        quantity: 1,
        unit_price: centsToDecimal(b.priceCents),
      },
    ],
    config: {
      statement_descriptor: settings.studioName.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 13) || undefined,
      online: {
        success_url: `${back}&r=sucesso`,
        pending_url: `${back}&r=pendente`,
        failure_url: `${back}&r=falha`,
        ...(isHttps() ? { auto_return: "all" } : {}),
      },
    },
  };

  try {
    const order = await mpFetch<MpOrder>("/v1/orders", { method: "POST", token: cfg.accessToken, idempotencyKey, body: JSON.stringify(body) });
    if (!order.checkout_url) throw new Error("Resposta sem checkout_url.");
    await db
      .update(payments)
      .set({ providerOrderId: order.id, checkoutUrl: order.checkout_url, updatedAt: new Date(), lastSyncedAt: new Date() })
      .where(eq(payments.id, attempt.id));
    return order.checkout_url;
  } catch (err) {
    await db.update(payments).set({ status: "cancelled", notes: "Falha ao criar pedido no Mercado Pago.", updatedAt: new Date() }).where(eq(payments.id, attempt.id));
    await logIntegrationError("create_order", (err as Error).message);
    if (err instanceof MpHttpError && (err.status === 401 || err.status === 403))
      throw new BusinessError("O pagamento online está temporariamente indisponível (credenciais do estúdio inválidas).");
    throw new BusinessError("Não conseguimos iniciar o pagamento agora. Tente novamente em instantes ou escolha pagar no dia.");
  }
}

/* ------------------------------------------------------------------ */
/* Sincronização de status (webhook / retorno / rotina)                */
/* ------------------------------------------------------------------ */

export function mapOrderStatus(order: MpOrder): ProviderSnapshot["status"] {
  const pay = order.transactions?.payments?.[0];
  const s = (pay?.status ?? order.status ?? "").toLowerCase();
  const d = (pay?.status_detail ?? order.status_detail ?? "").toLowerCase();
  const os = (order.status ?? "").toLowerCase();
  if (os === "refunded" || s === "refunded" || d === "refunded" || d === "partially_refunded") return "refunded";
  if (s === "charged_back" || d === "charged_back" || os === "charged_back") return "charged_back";
  if (s === "processed" || s === "approved" || d === "accredited") return "approved";
  if (s === "failed" || s === "rejected" || os === "failed") return "rejected";
  if (s === "canceled" || s === "cancelled" || os === "canceled" || os === "cancelled") return "cancelled";
  if (s === "expired" || os === "expired") return "expired";
  if (!pay && os === "created") return "created";
  return "pending";
}

/** Consulta o pedido na API oficial e aplica o resultado. Idempotente. */
export async function syncOrder(orderId: string) {
  const cfg = await getMpConfig();
  if (!cfg.accessToken) throw new Error("Mercado Pago não configurado.");
  const order = await mpFetch<MpOrder>(`/v1/orders/${encodeURIComponent(orderId)}`, { method: "GET", token: cfg.accessToken });
  const pay = order.transactions?.payments?.[0];
  const snapshot: ProviderSnapshot = {
    providerOrderId: order.id,
    providerPaymentId: pay?.id ?? null,
    status: mapOrderStatus(order),
    statusDetail: pay?.status_detail ?? order.status_detail ?? null,
    externalReference: order.external_reference ?? null,
    totalAmountCents: order.total_amount != null ? Math.round(Number(order.total_amount) * 100) : null,
    paidAmountCents: pay?.paid_amount != null ? Math.round(Number(pay.paid_amount) * 100) : order.total_paid_amount != null ? Math.round(Number(order.total_paid_amount) * 100) : null,
    currency: order.currency ?? "BRL",
    method: pay?.payment_method?.type ?? pay?.payment_method?.id ?? null,
    environment: cfg.environment,
  };
  return applyProviderPayment(snapshot);
}

/** Sincroniza tentativas online abertas de um agendamento (usado na página de retorno). */
export async function syncBookingPayments(bookingId: string) {
  const db = await getDb();
  const cfg = await getMpConfig();
  if (!cfg.accessToken) return;
  const list = await db.select().from(payments).where(eq(payments.bookingId, bookingId)).orderBy(desc(payments.createdAt));
  for (const p of list.slice(0, 3)) {
    if (p.provider !== "mercadopago" || !p.providerOrderId) continue;
    if (["approved", "refunded", "charged_back"].includes(p.status) && p.lastSyncedAt && Date.now() - p.lastSyncedAt.getTime() < 60_000) continue;
    try {
      await syncOrder(p.providerOrderId);
    } catch (err) {
      await logIntegrationError("sync_order", (err as Error).message);
    }
  }
}

/** Solicita reembolso total de um pedido aprovado. O status final vem da API. */
export async function refundOrder(orderId: string) {
  const cfg = await getMpConfig();
  if (!cfg.accessToken) throw new BusinessError("Mercado Pago não configurado.");
  try {
    await mpFetch(`/v1/orders/${encodeURIComponent(orderId)}/refund`, { method: "POST", token: cfg.accessToken, idempotencyKey: `refund-${orderId}`, body: "{}" });
  } catch (err) {
    await logIntegrationError("refund_order", (err as Error).message);
    throw new BusinessError(`O Mercado Pago não aceitou o reembolso: ${(err as Error).message}`);
  }
  return syncOrder(orderId);
}

/* ------------------------------------------------------------------ */
/* Webhooks                                                            */
/* ------------------------------------------------------------------ */

/**
 * Valida a assinatura x-signature (HMAC-SHA256).
 * Manifesto: "id:{data.id};request-id:{x-request-id};ts:{ts};" — data.id alfanumérico em minúsculas.
 */
export function verifyWebhookSignature(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
  toleranceSec?: number;
  now?: number;
}): boolean {
  const { xSignature, xRequestId, dataId, secret } = params;
  if (!xSignature) return false;
  const parts = Object.fromEntries(
    xSignature.split(",").map((kv) => {
      const [k, ...v] = kv.split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  let manifest = "";
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  if (params.toleranceSec) {
    const tsMs = Number(ts) > 1e12 ? Number(ts) : Number(ts) * 1000;
    if (Math.abs((params.now ?? Date.now()) - tsMs) > params.toleranceSec * 1000) return false;
  }
  return true;
}

export async function markWebhookReceived() {
  const db = await getDb();
  await db.insert(paymentIntegration).values({ id: 1, lastWebhookAt: new Date() }).onConflictDoUpdate({ target: paymentIntegration.id, set: { lastWebhookAt: new Date() } });
}

/** Notificações do tópico "payment" (legado): descobre o agendamento e sincroniza os pedidos dele. */
export async function syncFromPaymentId(paymentId: string) {
  const cfg = await getMpConfig();
  if (!cfg.accessToken) throw new Error("Mercado Pago não configurado.");
  const p = await mpFetch<{ external_reference?: string }>(`/v1/payments/${encodeURIComponent(paymentId)}`, { method: "GET", token: cfg.accessToken });
  if (p.external_reference && /^[0-9a-f-]{36}$/i.test(p.external_reference)) await syncBookingPayments(p.external_reference);
}
