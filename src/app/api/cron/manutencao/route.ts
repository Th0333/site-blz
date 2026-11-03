import { and, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { payments } from "@/db/schema";
import { expireStaleHolds } from "@/server/availability";
import { logIntegrationError, syncOrder, getMpConfig } from "@/server/mercadopago";

/**
 * Rotina periódica (Vercel Cron ou qualquer agendador):
 * - libera reservas temporárias vencidas;
 * - reconsulta no Mercado Pago pagamentos que seguem pendentes (caso algum webhook tenha se perdido).
 * Protegida por CRON_SECRET (Authorization: Bearer <CRON_SECRET>).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  await expireStaleHolds();
  let synced = 0;
  const cfg = await getMpConfig();
  if (cfg.accessToken) {
    const db = await getDb();
    const open = await db
      .select({ orderId: payments.providerOrderId })
      .from(payments)
      .where(and(eq(payments.provider, "mercadopago"), inArray(payments.status, ["created", "pending"]), lt(payments.createdAt, new Date(Date.now() - 5 * 60_000))))
      .limit(50);
    for (const p of open) {
      if (!p.orderId) continue;
      try {
        await syncOrder(p.orderId);
        synced++;
      } catch (err) {
        await logIntegrationError("cron_sync", (err as Error).message);
      }
    }
  }
  return Response.json({ ok: true, synced });
}
