import Link from "next/link";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { getDb } from "@/db";
import { bookings, professionals, user } from "@/db/schema";
import { getDailyRevenue, getFinanceSummary, getOperationalStats } from "@/server/finance";
import { hasDemoData } from "@/server/demo";
import { getMpConfig } from "@/server/mercadopago";
import { getSettings } from "@/server/settings";
import { expireStaleHolds } from "@/server/availability";
import { PageHeader, Card } from "@/components/admin/ui";
import { PeriodFilter } from "@/components/admin/period-filter";
import { RankBars, RevenueChart } from "@/components/admin/charts";
import { NumberTicker } from "@/components/ui/number-ticker";
import { StatusBadge } from "@/components/status-badge";
import { BOOKING_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/labels";
import { rangeFromParams } from "@/lib/range";
import { formatBRL } from "@/lib/money";
import { addDaysYmd, fmtTime, todayYmd, zonedToDate } from "@/lib/time";

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const range = rangeFromParams(sp);
  await expireStaleHolds();
  const [fin, ops, daily, demo, mp, s] = await Promise.all([
    getFinanceSummary(range),
    getOperationalStats(range),
    getDailyRevenue(range),
    hasDemoData(),
    getMpConfig(),
    getSettings(),
  ]);
  const monthRange = rangeFromParams({ periodo: "mes" });
  const finMonth = await getFinanceSummary(monthRange);

  const db = await getDb();
  const today = todayYmd();
  const todayList = await db
    .select({ b: bookings, pro: professionals.displayName, client: user.name })
    .from(bookings)
    .innerJoin(professionals, eq(professionals.id, bookings.professionalId))
    .innerJoin(user, eq(user.id, bookings.clientId))
    .where(and(gte(bookings.startsAt, zonedToDate(today, 0)), lt(bookings.startsAt, zonedToDate(addDaysYmd(today, 1), 0)), inArray(bookings.status, ["pending_payment", "scheduled", "confirmed", "completed", "no_show"])))
    .orderBy(asc(bookings.startsAt));

  return (
    <>
      <PageHeader title="Visão geral" description="Números reais do estúdio. Recebido = dinheiro confirmado; previsto e pendente vêm dos agendamentos." actions={<PeriodFilter preset={range.preset} from={range.fromYmd} to={range.toYmdInclusive} />} />

      {(demo || fin.reviewCount > 0 || (s.onlinePaymentEnabled && !mp.accessToken)) && (
        <div className="mb-6 space-y-2">
          {fin.reviewCount > 0 && (
            <Link href="/admin/financeiro?revisao=1" className="flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
              <AlertTriangle className="size-4 shrink-0" /> {fin.reviewCount} pagamento(s) com divergência aguardando revisão. <span className="ml-auto underline">Revisar</span>
            </Link>
          )}
          {demo && (
            <Link href="/admin/configuracoes#demonstracao" className="flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <AlertTriangle className="size-4 shrink-0" /> O site exibe conteúdo de demonstração. Cadastre os dados reais e remova a demonstração. <span className="ml-auto underline">Gerenciar</span>
            </Link>
          )}
          {s.onlinePaymentEnabled && !mp.accessToken && (
            <Link href="/admin/configuracoes/mercado-pago" className="flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <AlertTriangle className="size-4 shrink-0" /> Pagamento online ativado, mas o Mercado Pago não está configurado — a opção fica oculta para as clientes.
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Agendamentos hoje" value={ops.counts.today} />
        <Kpi label="Agendamentos futuros" value={ops.counts.upcoming} />
        <Kpi label="Concluídos no período" value={ops.period.completed} />
        <Kpi label="Cancelados no período" value={ops.period.cancelled} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Money label="Recebido hoje" cents={ops.receivedTodayCents} tone="teal" />
        <Money label="Recebido no mês" cents={finMonth.receivedCents} tone="merlot" />
        <Money label="Recebido no período" cents={fin.receivedCents} hint={`Online ${formatBRL(fin.receivedOnlineCents)} · Presencial ${formatBRL(fin.receivedInPersonCents)}`} />
        <Money label="Pendente de pagamento" cents={fin.pendingCents} hint={`Previsto no período: ${formatBRL(fin.expectedCents)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Faturamento recebido por dia" action={<Legend />}>
          <RevenueChart data={daily} />
        </Card>
        <Card title="Serviços mais agendados">
          <RankBars items={ops.topServices.map((t) => ({ name: t.name, value: t.n }))} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Desempenho por profissional" className="lg:col-span-1">
          {ops.byProfessional.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem agendamentos no período.</p>
          ) : (
            <ul className="divide-y divide-border">
              {ops.byProfessional.map((p) => (
                <li key={p.name} className="flex items-center justify-between py-2.5 text-sm">
                  <span>{p.name}</span>
                  <span className="text-muted-foreground"><strong className="text-graphite">{p.bookings}</strong> agend. · {p.completed} concl.</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Agenda de hoje" className="lg:col-span-2" action={<Link href="/admin/agenda" className="flex items-center gap-1 text-sm text-teal">Abrir agenda <ArrowUpRight className="size-3.5" /></Link>}>
          {todayList.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum atendimento hoje.</p>
          ) : (
            <ul className="divide-y divide-border">
              {todayList.map(({ b, pro, client }) => (
                <li key={b.id}>
                  <Link href={`/admin/agendamentos/${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-muted/40">
                    <span className="w-14 font-display text-xl text-petrol">{fmtTime(b.startsAt)}</span>
                    <span className="min-w-0 flex-1"><span className="font-medium">{client}</span> <span className="text-muted-foreground">· {b.serviceName} · {pro}</span></span>
                    <StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} />
                    <StatusBadge status={b.paymentStatus} label={PAYMENT_STATUS_LABEL[b.paymentStatus]} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-4xl text-petrol">{value === 0 ? "0" : <NumberTicker value={value} className="text-petrol" />}</p>
    </div>
  );
}

function Money({ label, cents, hint, tone }: { label: string; cents: number; hint?: string; tone?: "teal" | "merlot" }) {
  const dark = tone === "teal" ? "bg-teal-deep text-white" : tone === "merlot" ? "bg-merlot text-white" : "bg-card border border-border/80";
  return (
    <div className={`rounded-2xl p-5 ${dark}`}>
      <p className={`text-xs font-medium uppercase tracking-[0.08em] ${tone ? "text-white/70" : "text-muted-foreground"}`}>{label}</p>
      <p className={`mt-2 font-display text-[2rem] leading-tight ${tone ? "" : "text-graphite"}`}>{formatBRL(cents)}</p>
      {hint && <p className={`mt-1 text-xs ${tone ? "text-white/70" : "text-muted-foreground"}`}>{hint}</p>}
    </div>
  );
}

function Legend() {
  return (
    <span className="flex gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-merlot" /> Online</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-teal" /> Presencial</span>
    </span>
  );
}
