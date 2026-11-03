import { and, desc, eq, gte, ilike, inArray, isNotNull, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, financialEntries, payments, professionals, user } from "@/db/schema";
import { addDaysYmd, toYmd, zonedToDate } from "@/lib/time";

export type Range = { from: Date; to: Date };

/**
 * Indicadores financeiros. "Recebido" vem exclusivamente do livro-caixa (financial_entries),
 * ou seja, dinheiro confirmado. Valores pendentes/previstos vêm dos agendamentos.
 */
export async function getFinanceSummary({ from, to }: Range) {
  const db = await getDb();
  const entries = await db
    .select({ kind: financialEntries.kind, channel: financialEntries.channel, amount: financialEntries.amountCents, fee: financialEntries.feeCents })
    .from(financialEntries)
    .where(and(gte(financialEntries.occurredAt, from), lt(financialEntries.occurredAt, to)));

  let gross = 0;
  let refunds = 0;
  let online = 0;
  let inPerson = 0;
  let fees = 0;
  for (const e of entries) {
    if (e.kind === "receipt") gross += e.amount;
    else refunds += -e.amount;
    if (e.channel === "online") online += e.amount;
    else inPerson += e.amount;
    if (e.fee) fees += e.fee;
  }

  const [agg] = await db
    .select({
      pending: sql<number>`coalesce(sum(${bookings.priceCents}) filter (where ${bookings.paymentStatus} = 'pending' and ${bookings.status} in ('pending_payment','scheduled','confirmed','completed')), 0)::int`,
      expected: sql<number>`coalesce(sum(${bookings.priceCents}) filter (where ${bookings.status} in ('pending_payment','scheduled','confirmed','completed')), 0)::int`,
      review: sql<number>`count(*) filter (where ${bookings.paymentStatus} = 'review')::int`,
    })
    .from(bookings)
    .where(and(gte(bookings.startsAt, from), lt(bookings.startsAt, to)));

  const [allReview] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(payments)
    .where(and(isNotNull(payments.reviewReason), sql`${payments.reviewResolvedAt} is null`));

  return {
    grossReceivedCents: gross,
    refundedCents: refunds,
    receivedCents: gross - refunds,
    receivedOnlineCents: online,
    receivedInPersonCents: inPerson,
    knownFeesCents: fees,
    estimatedNetCents: gross - refunds - fees,
    pendingCents: agg.pending,
    expectedCents: agg.expected,
    reviewCount: allReview.n,
  };
}

/** Recebido por dia (fuso do estúdio) para gráficos. */
export async function getDailyRevenue({ from, to }: Range) {
  const db = await getDb();
  const rows = await db
    .select({ at: financialEntries.occurredAt, amount: financialEntries.amountCents, channel: financialEntries.channel })
    .from(financialEntries)
    .where(and(gte(financialEntries.occurredAt, from), lt(financialEntries.occurredAt, to)));
  const map = new Map<string, { online: number; inPerson: number }>();
  for (let d = toYmd(from); d < toYmd(to) || d === toYmd(from); d = addDaysYmd(d, 1)) {
    map.set(d, { online: 0, inPerson: 0 });
    if (map.size > 400) break;
  }
  for (const r of rows) {
    const k = toYmd(r.at);
    const v = map.get(k) ?? { online: 0, inPerson: 0 };
    if (r.channel === "online") v.online += r.amount;
    else v.inPerson += r.amount;
    map.set(k, v);
  }
  return [...map.entries()].sort().map(([ymd, v]) => ({ ymd, ...v, total: v.online + v.inPerson }));
}

export async function getRevenueBreakdown({ from, to }: Range) {
  const db = await getDb();
  const byProfessional = await db
    .select({ name: professionals.displayName, cents: sql<number>`sum(${financialEntries.amountCents})::int` })
    .from(financialEntries)
    .innerJoin(bookings, eq(bookings.id, financialEntries.bookingId))
    .innerJoin(professionals, eq(professionals.id, bookings.professionalId))
    .where(and(gte(financialEntries.occurredAt, from), lt(financialEntries.occurredAt, to)))
    .groupBy(professionals.displayName)
    .orderBy(desc(sql`sum(${financialEntries.amountCents})`));
  const byService = await db
    .select({ name: bookings.serviceName, cents: sql<number>`sum(${financialEntries.amountCents})::int` })
    .from(financialEntries)
    .innerJoin(bookings, eq(bookings.id, financialEntries.bookingId))
    .where(and(gte(financialEntries.occurredAt, from), lt(financialEntries.occurredAt, to)))
    .groupBy(bookings.serviceName)
    .orderBy(desc(sql`sum(${financialEntries.amountCents})`));
  return { byProfessional, byService };
}

/** Indicadores operacionais do dashboard (contagens de agendamentos). */
export async function getOperationalStats({ from, to }: Range, now = new Date()) {
  const db = await getDb();
  const today = toYmd(now);
  const todayStart = zonedToDate(today, 0);
  const todayEnd = zonedToDate(addDaysYmd(today, 1), 0);

  const [counts] = await db
    .select({
      today: sql<number>`count(*) filter (where ${bookings.startsAt} >= ${todayStart} and ${bookings.startsAt} < ${todayEnd} and ${bookings.status} in ('pending_payment','scheduled','confirmed','completed'))::int`,
      upcoming: sql<number>`count(*) filter (where ${bookings.startsAt} >= ${now} and ${bookings.status} in ('pending_payment','scheduled','confirmed'))::int`,
    })
    .from(bookings);

  const [period] = await db
    .select({
      completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')::int`,
      cancelled: sql<number>`count(*) filter (where ${bookings.status} = 'cancelled')::int`,
      noShow: sql<number>`count(*) filter (where ${bookings.status} = 'no_show')::int`,
      total: sql<number>`count(*) filter (where ${bookings.status} not in ('expired'))::int`,
    })
    .from(bookings)
    .where(and(gte(bookings.startsAt, from), lt(bookings.startsAt, to)));

  const topServices = await db
    .select({ name: bookings.serviceName, n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(gte(bookings.startsAt, from), lt(bookings.startsAt, to), inArray(bookings.status, ["pending_payment", "scheduled", "confirmed", "completed", "no_show"])))
    .groupBy(bookings.serviceName)
    .orderBy(desc(sql`count(*)`))
    .limit(6);

  const byProfessional = await db
    .select({
      name: professionals.displayName,
      bookings: sql<number>`count(*) filter (where ${bookings.status} in ('pending_payment','scheduled','confirmed','completed','no_show'))::int`,
      completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')::int`,
    })
    .from(bookings)
    .innerJoin(professionals, eq(professionals.id, bookings.professionalId))
    .where(and(gte(bookings.startsAt, from), lt(bookings.startsAt, to)))
    .groupBy(professionals.displayName)
    .orderBy(desc(sql`count(*)`));

  const receivedToday = await getFinanceSummary({ from: todayStart, to: todayEnd });
  return { counts, period, topServices, byProfessional, receivedTodayCents: receivedToday.receivedCents };
}

export type TxFilters = {
  from?: Date;
  to?: Date;
  status?: string;
  provider?: "mercadopago" | "manual";
  q?: string;
  review?: boolean;
};

/** Histórico de transações com filtros (também usado na exportação CSV). */
export async function listTransactions(f: TxFilters, limit = 200) {
  const db = await getDb();
  const conds: SQL[] = [];
  if (f.from) conds.push(gte(payments.createdAt, f.from));
  if (f.to) conds.push(lt(payments.createdAt, f.to));
  if (f.status) conds.push(eq(payments.status, f.status as never));
  if (f.provider) conds.push(eq(payments.provider, f.provider));
  if (f.review) conds.push(and(isNotNull(payments.reviewReason), sql`${payments.reviewResolvedAt} is null`)!);
  if (f.q) {
    const q = `%${f.q.replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(user.name, q), ilike(user.email, q), ilike(bookings.code, q), ilike(bookings.serviceName, q), ilike(payments.providerOrderId, q))!);
  }
  return db
    .select({
      payment: payments,
      bookingCode: bookings.code,
      bookingId: bookings.id,
      serviceName: bookings.serviceName,
      startsAt: bookings.startsAt,
      clientName: user.name,
      clientEmail: user.email,
      professionalName: professionals.displayName,
    })
    .from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .innerJoin(user, eq(user.id, bookings.clientId))
    .innerJoin(professionals, eq(professionals.id, bookings.professionalId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(payments.createdAt))
    .limit(limit);
}
