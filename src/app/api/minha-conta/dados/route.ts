import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, payments, user } from "@/db/schema";
import { getSessionUser } from "@/server/session";

/** Portabilidade (LGPD): exporta os dados da própria cliente em JSON. */
export async function GET() {
  const u = await getSessionUser();
  if (!u) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const db = await getDb();
  const [profile] = await db.select({ name: user.name, email: user.email, phone: user.phone, createdAt: user.createdAt }).from(user).where(eq(user.id, u.id));
  const bks = await db.select().from(bookings).where(eq(bookings.clientId, u.id)).orderBy(desc(bookings.startsAt));
  const pays = bks.length ? await db.select().from(payments).where(inArray(payments.bookingId, bks.map((b) => b.id))) : [];
  const data = {
    exportadoEm: new Date().toISOString(),
    perfil: profile,
    agendamentos: bks.map((b) => ({ codigo: b.code, servico: b.serviceName, inicio: b.startsAt, status: b.status, valorCentavos: b.priceCents, formaPagamento: b.paymentMethod, statusPagamento: b.paymentStatus })),
    pagamentos: pays.map((p) => ({ agendamento: bks.find((b) => b.id === p.bookingId)?.code, provedor: p.provider, meio: p.method, status: p.status, valorCentavos: p.amountCents, pagoEm: p.paidAt })),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="meus-dados.json"', "Cache-Control": "no-store" },
  });
}
