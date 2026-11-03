import Link from "next/link";
import { Download, Info } from "lucide-react";
import { PAYMENT_TX_STATUSES } from "@/db/schema";
import { getFinanceSummary, getRevenueBreakdown, listTransactions } from "@/server/finance";
import { PageHeader, Card, Table, Th, Td, EmptyState, selectClass } from "@/components/admin/ui";
import { PeriodFilter } from "@/components/admin/period-filter";
import { RankBars } from "@/components/admin/charts";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { PAYMENT_TX_LABEL, TX_METHOD_LABEL } from "@/lib/labels";
import { rangeFromParams } from "@/lib/range";
import { formatBRL } from "@/lib/money";
import { fmtDate, fmtDateTime } from "@/lib/time";

export const metadata = { title: "Financeiro" };

export default async function FinanceAdmin({ searchParams }: PageProps<"/admin/financeiro">) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const range = rangeFromParams(sp);
  const review = get("revisao") === "1";
  const filters = {
    from: review ? undefined : range.from,
    to: review ? undefined : range.to,
    status: (PAYMENT_TX_STATUSES as readonly string[]).includes(get("status")) ? get("status") : undefined,
    provider: get("canal") === "online" ? ("mercadopago" as const) : get("canal") === "presencial" ? ("manual" as const) : undefined,
    q: get("q") || undefined,
    review,
  };
  const [sum, breakdown, txs] = await Promise.all([getFinanceSummary(range), getRevenueBreakdown(range), listTransactions(filters)]);
  const csvQuery = new URLSearchParams(Object.entries({ periodo: range.preset, de: range.fromYmd, ate: range.toYmdInclusive, status: filters.status ?? "", canal: get("canal"), q: get("q"), revisao: review ? "1" : "" }).filter(([, v]) => v));

  return (
    <>
      <PageHeader title="Financeiro" description="Receita bruta considera apenas pagamentos confirmados. Valores pendentes e previstos não entram como recebidos." actions={<PeriodFilter preset={range.preset} from={range.fromYmd} to={range.toYmdInclusive} />} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total bruto recebido" value={sum.grossReceivedCents} strong />
        <Stat label="Recebido online" value={sum.receivedOnlineCents} />
        <Stat label="Recebido presencialmente" value={sum.receivedInPersonCents} />
        <Stat label="Reembolsado" value={sum.refundedCents} />
        <Stat label="Pendente de pagamento" value={sum.pendingCents} hint="Agendamentos do período ainda não pagos" />
        <Stat label="Previsto no período" value={sum.expectedCents} hint="Soma dos agendamentos ativos" />
        <Stat label="Taxas informadas" value={sum.knownFeesCents} hint="Somente quando o provedor informa" />
        <Stat label="Líquido estimado" value={sum.estimatedNetCents} hint="Recebido − reembolsos − taxas conhecidas" />
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" /> O líquido estimado não é o saldo disponível na conta Mercado Pago: prazos de liberação, antecipações e tarifas não informadas pela API podem fazer o saldo real ser diferente. Confira sempre no painel do Mercado Pago.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Receita por profissional"><RankBars items={breakdown.byProfessional.map((r) => ({ name: r.name, value: r.cents }))} format="brl" /></Card>
        <Card title="Receita por serviço"><RankBars items={breakdown.byService.map((r) => ({ name: r.name, value: r.cents }))} format="brl" /></Card>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-display text-3xl text-petrol">{review ? "Pagamentos aguardando revisão" : "Histórico de transações"}</h2>
        <div className="flex gap-2">
          {review ? <Link href="/admin/financeiro" className={buttonVariants({ variant: "outline", size: "sm" })}>Ver todas</Link> : sum.reviewCount > 0 && <Link href="/admin/financeiro?revisao=1" className={buttonVariants({ variant: "outline", size: "sm" })}>Revisão ({sum.reviewCount})</Link>}
          <a href={`/api/admin/financeiro/csv?${csvQuery}`} className={buttonVariants({ variant: "teal", size: "sm" })}><Download className="size-4" /> Exportar CSV</a>
        </div>
      </div>
      <form className="my-4 grid gap-2 sm:grid-cols-4" role="search">
        <input type="hidden" name="periodo" value={range.preset} />
        {range.preset === "personalizado" && (<><input type="hidden" name="de" value={range.fromYmd} /><input type="hidden" name="ate" value={range.toYmdInclusive} /></>)}
        <input name="q" defaultValue={get("q")} placeholder="Cliente, código ou ID do pedido" className={selectClass} aria-label="Pesquisar" />
        <select name="status" defaultValue={get("status")} className={selectClass} aria-label="Status">
          <option value="">Todos os status</option>
          {PAYMENT_TX_STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_TX_LABEL[s]}</option>)}
        </select>
        <select name="canal" defaultValue={get("canal")} className={selectClass} aria-label="Canal">
          <option value="">Online e presencial</option>
          <option value="online">Online (Mercado Pago)</option>
          <option value="presencial">Presencial</option>
        </select>
        <button className={buttonVariants({ variant: "outline" })}>Filtrar</button>
      </form>

      {txs.length === 0 ? (
        <EmptyState title="Nenhuma transação" text="Pagamentos online e recebimentos presenciais aparecem aqui." />
      ) : (
        <Table>
          <thead><tr><Th>Cliente</Th><Th>Serviço / profissional</Th><Th>Atendimento</Th><Th>Meio</Th><Th>Bruto</Th><Th>Taxa / líquido</Th><Th>Status</Th><Th>Pago em</Th><Th>Identificador</Th></tr></thead>
          <tbody>
            {txs.map((t) => (
              <tr key={t.payment.id} className="hover:bg-muted/30">
                <Td><Link href={`/admin/agendamentos/${t.bookingId}`} className="text-petrol hover:underline">{t.clientName}</Link><span className="block text-xs text-muted-foreground">{t.bookingCode}</span></Td>
                <Td>{t.serviceName}<span className="block text-xs text-muted-foreground">{t.professionalName}</span></Td>
                <Td>{fmtDate(t.startsAt)}</Td>
                <Td>{t.payment.provider === "manual" ? "Presencial" : "Mercado Pago"}<span className="block text-xs text-muted-foreground">{t.payment.method ? TX_METHOD_LABEL[t.payment.method] ?? t.payment.method : "—"}</span></Td>
                <Td className="font-medium">{formatBRL(t.payment.paidAmountCents ?? t.payment.amountCents)}</Td>
                <Td>{t.payment.feeCents != null ? <>{formatBRL(t.payment.feeCents)}<span className="block text-xs text-muted-foreground">{t.payment.netCents != null ? formatBRL(t.payment.netCents) : "—"}</span></> : <span className="text-xs text-muted-foreground">não informado</span>}</Td>
                <Td><StatusBadge status={t.payment.status} label={PAYMENT_TX_LABEL[t.payment.status]} />{t.payment.reviewReason && !t.payment.reviewResolvedAt && <span className="mt-1 block max-w-48 text-xs text-red-700">{t.payment.reviewReason}</span>}</Td>
                <Td>{t.payment.paidAt ? fmtDateTime(t.payment.paidAt) : "—"}</Td>
                <Td className="max-w-40 break-all text-xs text-muted-foreground">{t.payment.providerPaymentId ?? t.payment.providerOrderId ?? "—"}{t.payment.notes && <span className="mt-1 block text-graphite">{t.payment.notes}</span>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

function Stat({ label, value, hint, strong }: { label: string; value: number; hint?: string; strong?: boolean }) {
  return (
    <div className={strong ? "rounded-2xl bg-petrol p-5 text-white" : "rounded-2xl border border-border/80 bg-card p-5"}>
      <p className={`text-xs font-medium uppercase tracking-[0.08em] ${strong ? "text-white/70" : "text-muted-foreground"}`}>{label}</p>
      <p className="mt-2 font-display text-[1.9rem] leading-tight">{formatBRL(value)}</p>
      {hint && <p className={`mt-1 text-xs ${strong ? "text-white/70" : "text-muted-foreground"}`}>{hint}</p>}
    </div>
  );
}
