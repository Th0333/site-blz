import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, Phone, Mail } from "lucide-react";
import { getDb } from "@/db";
import { auditLogs, bookings, payments, professionals, user } from "@/db/schema";
import { expireStaleHolds } from "@/server/availability";
import { PageHeader, Card } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import { BOOKING_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_TX_LABEL, TX_METHOD_LABEL } from "@/lib/labels";
import { formatBRL } from "@/lib/money";
import { fmtDate, fmtDateTime, fmtDuration, fmtTime, fmtWeekday, toYmd, hhmm, minutesOfDay } from "@/lib/time";
import { whatsappLink } from "@/lib/media-url";
import { BookingAdminActions, PaymentPanel, NotesForm } from "./parts";

export default async function BookingDetail({ params }: PageProps<"/admin/agendamentos/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  await expireStaleHolds();
  const db = await getDb();
  const [row] = await db
    .select({ b: bookings, client: user, pro: professionals.displayName })
    .from(bookings)
    .innerJoin(user, eq(user.id, bookings.clientId))
    .innerJoin(professionals, eq(professionals.id, bookings.professionalId))
    .where(eq(bookings.id, id));
  if (!row) notFound();
  const { b, client } = row;
  const pays = await db.select().from(payments).where(eq(payments.bookingId, id)).orderBy(desc(payments.createdAt));
  const history = await db
    .select({ a: auditLogs, actor: user.name })
    .from(auditLogs)
    .leftJoin(user, eq(user.id, auditLogs.actorId))
    .where(and(inArray(auditLogs.entityId, [id, ...pays.map((p) => p.id)]), inArray(auditLogs.entity, ["booking", "payment"])))
    .orderBy(asc(auditLogs.createdAt));
  const pros = await db.select({ id: professionals.id, name: professionals.displayName }).from(professionals).where(eq(professionals.active, true)).orderBy(asc(professionals.displayName));
  const wa = client.phone ? whatsappLink(client.phone.length <= 11 ? `55${client.phone}` : client.phone, `Olá, ${client.name.split(" ")[0]}! Aqui é do estúdio, sobre seu agendamento ${b.code}.`) : null;

  return (
    <>
      <Link href="/admin/agendamentos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-petrol"><ArrowLeft className="size-4" /> Agendamentos</Link>
      <PageHeader
        eyebrow={`Código ${b.code}`}
        title={b.serviceName}
        description={<span>{fmtWeekday(b.startsAt)}, {fmtDate(b.startsAt)} · {fmtTime(b.startsAt)}–{fmtTime(b.endsAt)} ({fmtDuration(b.durationMin)}{b.bufferMin ? ` + ${b.bufferMin} min preparo` : ""}) · {row.pro}</span>}
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} />
            <StatusBadge status={b.paymentStatus} label={`Pagamento: ${PAYMENT_STATUS_LABEL[b.paymentStatus]}`} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Atendimento">
            <BookingAdminActions
              booking={{ id: b.id, status: b.status, checkedIn: !!b.checkedInAt, ymd: toYmd(b.startsAt), time: hhmm(minutesOfDay(b.startsAt)), professionalId: b.professionalId }}
              pros={pros}
            />
            {b.status === "pending_payment" && b.holdExpiresAt && (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Reserva temporária aguardando pagamento online até {fmtDateTime(b.holdExpiresAt)}. Depois disso o horário é liberado automaticamente.</p>
            )}
            {b.cancelReason && <p className="mt-4 text-sm text-muted-foreground">Motivo do cancelamento: {b.cancelReason}</p>}
            {b.checkedInAt && <p className="mt-2 text-sm text-muted-foreground">Chegada registrada em {fmtDateTime(b.checkedInAt)}.</p>}
          </Card>

          <Card title="Pagamentos">
            <PaymentPanel
              booking={{ id: b.id, priceCents: b.priceCents, paymentStatus: b.paymentStatus, status: b.status, method: b.paymentMethod }}
              payments={pays.map((p) => ({
                id: p.id,
                provider: p.provider,
                status: p.status,
                statusLabel: PAYMENT_TX_LABEL[p.status],
                method: p.method ? TX_METHOD_LABEL[p.method] ?? p.method : null,
                amount: formatBRL(p.paidAmountCents ?? p.amountCents),
                fee: p.feeCents != null ? formatBRL(p.feeCents) : null,
                date: fmtDateTime(p.paidAt ?? p.createdAt),
                orderId: p.providerOrderId,
                paymentId: p.providerPaymentId,
                environment: p.environment,
                notes: p.notes,
                review: p.reviewReason && !p.reviewResolvedAt ? p.reviewReason : null,
              }))}
            />
          </Card>

          <Card title="Histórico">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem registros.</p>
            ) : (
              <ol className="space-y-3 border-l border-border pl-4">
                {history.map(({ a, actor }) => (
                  <li key={a.id} className="text-sm">
                    <span className="font-medium">{describe(a.action)}</span>
                    <span className="text-muted-foreground"> · {actor ?? "Sistema"} · {fmtDateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Cliente">
            <p className="font-display text-2xl text-petrol">{client.name}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" /><a href={`mailto:${client.email}`} className="break-all hover:underline">{client.email}</a></li>
              {client.phone && <li className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" />{client.phone}{wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="ml-auto text-teal underline">WhatsApp</a>}</li>}
            </ul>
            <Link href={`/admin/clientes/${client.id}`} className="mt-4 inline-block text-sm text-teal underline">Ver histórico da cliente</Link>
          </Card>
          <Card title="Resumo">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Valor</dt><dd className="font-semibold">{formatBRL(b.priceCents)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Forma escolhida</dt><dd>{PAYMENT_METHOD_LABEL[b.paymentMethod]}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Criado em</dt><dd>{fmtDateTime(b.createdAt)}</dd></div>
              {b.rescheduledFrom && <div className="flex justify-between"><dt className="text-muted-foreground">Remarcado de</dt><dd>{fmtDateTime(b.rescheduledFrom)}</dd></div>}
            </dl>
            {b.clientNotes && <p className="mt-4 rounded-xl bg-paper p-3 text-sm"><span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observação da cliente</span>{b.clientNotes}</p>}
          </Card>
          <Card title="Notas internas">
            <NotesForm id={b.id} notes={b.adminNotes ?? ""} />
          </Card>
        </div>
      </div>
    </>
  );
}

const ACTION_LABEL: Record<string, string> = {
  "booking.create": "Agendamento criado",
  "booking.cancel": "Cancelado",
  "booking.reschedule": "Reagendado",
  "booking.checkin": "Chegada registrada",
  "booking.status.confirmed": "Confirmado",
  "booking.status.completed": "Concluído",
  "booking.status.no_show": "Não compareceu",
  "booking.status.scheduled": "Voltou para agendado",
  "booking.notes": "Notas atualizadas",
  "booking.switch_in_person": "Cliente trocou para pagamento no dia",
  "booking.convert_in_person": "Convertido para pagamento no dia",
  "payment.manual_register": "Pagamento presencial registrado",
  "payment.manual_refund": "Estorno presencial registrado",
  "payment.approved": "Pagamento online aprovado",
  "payment.refunded": "Pagamento estornado",
  "payment.charged_back": "Contestação (chargeback)",
  "payment.refund_requested": "Reembolso solicitado ao Mercado Pago",
  "payment.review_resolved": "Divergência resolvida",
};
const describe = (a: string) => ACTION_LABEL[a] ?? a;
