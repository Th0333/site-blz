import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { CheckCircle2, Clock3, AlertTriangle, XCircle } from "lucide-react";
import { getDb } from "@/db";
import { payments } from "@/db/schema";
import { requireUserPage } from "@/server/session";
import { getBookingForUser } from "@/server/bookings";
import { getSettings } from "@/server/settings";
import { expireStaleHolds } from "@/server/availability";
import { buttonVariants } from "@/components/ui/button";
import { SwatchWord } from "@/components/site/swatch";
import { BOOKING_STATUS_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { formatBRL } from "@/lib/money";
import { fmtDate, fmtDuration, fmtTime, fmtWeekday } from "@/lib/time";
import { cn } from "@/lib/utils";
import { PaymentActions } from "./payment-actions";
import { TextureCardStyled } from "@/components/ui/texture-card";

export const metadata: Metadata = { title: "Agendamento", robots: { index: false } };

export default async function ConfirmationPage({ params, searchParams }: PageProps<"/agendar/confirmacao/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUserPage(`/agendar/confirmacao/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  await expireStaleHolds();
  const row = await getBookingForUser(id, user.id);
  if (!row) notFound();
  const b = row.booking;
  const s = await getSettings();
  const db = await getDb();
  const [lastPayment] = await db.select().from(payments).where(eq(payments.bookingId, b.id)).orderBy(desc(payments.createdAt)).limit(1);

  const isPaid = b.paymentStatus === "paid";
  const awaitingOnline = b.status === "pending_payment";
  const expired = b.status === "expired";
  const cameBack = typeof sp.r === "string";

  const headline = expired
    ? { icon: <XCircle className="size-6" />, title: "Reserva expirada", tone: "merlot" as const, text: "O prazo para pagamento terminou e o horário foi liberado. Você pode escolher um novo horário quando quiser." }
    : b.status === "cancelled"
      ? { icon: <XCircle className="size-6" />, title: "Agendamento cancelado", tone: "merlot" as const, text: "Este agendamento foi cancelado." }
      : awaitingOnline
        ? {
            icon: <Clock3 className="size-6" />,
            title: lastPayment?.status === "pending" ? "Pagamento em processamento" : "Horário reservado — falta o pagamento",
            tone: "teal" as const,
            text:
              lastPayment?.status === "pending"
                ? "O Mercado Pago ainda está processando seu pagamento (por exemplo, Pix aguardando compensação). Assim que for confirmado, seu agendamento é confirmado automaticamente."
                : lastPayment?.status === "rejected"
                  ? "O pagamento não foi aprovado. Seu horário continua reservado por alguns minutos: tente novamente com outro meio de pagamento."
                  : `Seu horário está reservado até ${b.holdExpiresAt ? fmtTime(b.holdExpiresAt) : "o fim do prazo"}. Conclua o pagamento para confirmar.`,
          }
        : { icon: <CheckCircle2 className="size-6" />, title: "Agendamento confirmado", tone: "teal" as const, text: isPaid ? "Pagamento aprovado. Está tudo certo — até breve!" : "Seu horário está garantido. O pagamento será feito no dia do atendimento." };

  return (
    <div className="bg-paper pb-24 pt-28 sm:pt-36">
      <div className="mx-auto max-w-[980px] px-4 sm:px-6">
        {cameBack && (
          <p className="mb-6 rounded-xl bg-teal-mist px-4 py-3 text-sm text-teal-deep">
            Você voltou do Mercado Pago. O status abaixo foi consultado diretamente no Mercado Pago e no nosso sistema — não depende da página de retorno.
          </p>
        )}
        <div className={cn("inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold", headline.tone === "teal" ? "bg-teal-mist text-teal-deep" : "bg-blush-veil text-merlot")}>
          {headline.icon} {headline.title}
        </div>
        <h1 className="display mt-6 text-[clamp(2.6rem,6.4vw,4.6rem)] text-petrol">
          {expired || b.status === "cancelled" ? (
            "Vamos remarcar?"
          ) : (
            <>
              Até breve, <SwatchWord color="var(--brand-teal-haze)"><span className="italic">{row.clientName.split(" ")[0]}</span></SwatchWord>.
            </>
          )}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{headline.text}</p>

        <div className="mt-12 grid gap-6 md:grid-cols-5">
          {/* Moldura em camadas do Texture Card (Cult UI), adaptada à paleta da marca */}
          <TextureCardStyled className="border-white/80 from-[#fffdfc] to-[#f6f2f1] md:col-span-3">
          <section className="p-6 text-graphite sm:p-8" aria-label="Detalhes do agendamento">
            <div className="flex items-baseline justify-between gap-4">
              <p className="eyebrow text-teal">Código</p>
              <p className="font-mono text-lg tracking-[0.2em] text-petrol">{b.code}</p>
            </div>
            <dl className="mt-6 divide-y divide-border">
              <Row label="Cliente" value={row.clientName} />
              <Row label="Serviço" value={b.serviceName} />
              <Row label="Profissional" value={row.professionalName} />
              <Row label="Data" value={<span>{fmtWeekday(b.startsAt)}, {fmtDate(b.startsAt)}</span>} />
              <Row label="Horário" value={`${fmtTime(b.startsAt)} · ${fmtDuration(b.durationMin)}`} />
              {s.address && <Row label="Local" value={<span className="whitespace-pre-line">{s.address}</span>} />}
              <Row label="Status do atendimento" value={BOOKING_STATUS_LABEL[b.status]} />
            </dl>
          </section>
          </TextureCardStyled>

          <section className="flex flex-col rounded-[26px] bg-petrol p-6 text-white grain sm:p-8 md:col-span-2" aria-label="Pagamento">
            <p className="eyebrow text-teal-haze">Pagamento</p>
            <p className="mt-4 font-display text-4xl">{formatBRL(b.priceCents)}</p>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-[#a9c6c4]">Forma</dt><dd>{PAYMENT_METHOD_LABEL[b.paymentMethod]}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#a9c6c4]">Status do pagamento</dt><dd className="font-semibold">{PAYMENT_STATUS_LABEL[b.paymentStatus]}</dd></div>
            </dl>
            {b.paymentStatus === "review" && (
              <p className="mt-4 flex gap-2 rounded-xl bg-white/10 p-3 text-xs leading-relaxed">
                <AlertTriangle className="size-4 shrink-0" /> Recebemos um pagamento que precisa de conferência da equipe. Entraremos em contato.
              </p>
            )}
            <div className="mt-auto pt-8">
              {awaitingOnline && lastPayment?.status !== "pending" && <PaymentActions bookingId={b.id} allowInPerson={s.inPersonPaymentEnabled} />}
            </div>
          </section>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/minha-conta" className={buttonVariants({ size: "lg" })}>Ver meus agendamentos</Link>
          {(expired || b.status === "cancelled") && <Link href="/agendar" className={buttonVariants({ variant: "outline", size: "lg" })}>Escolher novo horário</Link>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-graphite">{value}</dd>
    </div>
  );
}
