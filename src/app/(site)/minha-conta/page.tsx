import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { CalendarClock, MapPin } from "lucide-react";
import { getDb } from "@/db";
import { bookings, events, payments, professionals, testimonials } from "@/db/schema";
import { requireUserPage } from "@/server/session";
import { getSettings } from "@/server/settings";
import { expireStaleHolds } from "@/server/availability";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { SwatchWord } from "@/components/site/swatch";
import { BOOKING_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_TX_LABEL, TX_METHOD_LABEL } from "@/lib/labels";
import { formatBRL } from "@/lib/money";
import { fmtDate, fmtDateTime, fmtDuration, fmtTime, fmtWeekday } from "@/lib/time";
import { cn } from "@/lib/utils";
import { BookingActions, ProfileForm, TestimonialForm, MarkReadButton, DangerZone } from "./client-parts";

export const metadata: Metadata = { title: "Minha conta", robots: { index: false } };

export default async function MyAccountPage() {
  const u = await requireUserPage("/minha-conta");
  const db = await getDb();
  const now = new Date();
  const [s] = await Promise.all([getSettings(), expireStaleHolds()]);

  const list = await db
    .select({ b: bookings, pro: professionals.displayName })
    .from(bookings)
    .innerJoin(professionals, eq(professionals.id, bookings.professionalId))
    .where(eq(bookings.clientId, u.id))
    .orderBy(desc(bookings.startsAt));
  const ids = list.map((l) => l.b.id);
  const [pays, reviewed, notes] = await Promise.all([
    ids.length ? db.select().from(payments).where(inArray(payments.bookingId, ids)).orderBy(desc(payments.createdAt)) : Promise.resolve([]),
    ids.length ? db.select({ id: testimonials.bookingId }).from(testimonials).where(inArray(testimonials.bookingId, ids)) : Promise.resolve([]),
    db.select().from(events).where(eq(events.userId, u.id)).orderBy(desc(events.createdAt)).limit(8),
  ]);
  const reviewedSet = new Set(reviewed.map((r) => r.id));
  const unread = notes.filter((n) => !n.readAt).length;

  const upcoming = list.filter((l) => l.b.startsAt > now && ["pending_payment", "scheduled", "confirmed"].includes(l.b.status)).reverse();
  const history = list.filter((l) => !upcoming.includes(l));
  const next = upcoming[0];
  const firstName = u.name.split(" ")[0];

  const policy = { allowCancel: s.allowClientCancel, allowReschedule: s.allowClientReschedule, cancelMinHours: s.cancelMinHours, rescheduleMinHours: s.rescheduleMinHours };

  return (
    <div className="bg-paper pb-24 pt-28 sm:pt-36">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-10">
        <p className="eyebrow text-teal">Minha conta</p>
        <h1 className="display mt-3 text-[clamp(2.5rem,6vw,4.4rem)] text-petrol">
          Olá, <SwatchWord color="var(--brand-teal-haze)"><span className="italic">{firstName}</span></SwatchWord>!
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          {next ? "Seja bem-vinda! Seu próximo momento de beleza está chegando." : "Que bom ter você por aqui. Quando quiser, é só reservar seu próximo horário."}
        </p>

        {/* Próximo agendamento */}
        {next ? (
          <section aria-label="Próximo agendamento" className="mt-10 overflow-hidden rounded-[28px] bg-petrol text-white grain">
            <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-[1.3fr_1fr]">
              <div>
                <p className="eyebrow text-teal-haze">Próximo atendimento</p>
                <p className="mt-4 font-display text-[clamp(2rem,4.6vw,3.4rem)] leading-none">{next.b.serviceName}</p>
                <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[#cfe0df]">
                  <span className="flex items-center gap-2"><CalendarClock className="size-4" />{fmtWeekday(next.b.startsAt)}, {fmtDate(next.b.startsAt)} · {fmtTime(next.b.startsAt)}</span>
                  <span>com {next.pro}</span>
                </p>
                {s.address && <p className="mt-3 flex items-start gap-2 text-sm text-[#a9c6c4]"><MapPin className="mt-0.5 size-4 shrink-0" /><span className="whitespace-pre-line">{s.address}</span></p>}
              </div>
              <div className="flex flex-col justify-between gap-6 md:items-end">
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <StatusBadge status={next.b.status} label={BOOKING_STATUS_LABEL[next.b.status]} dark />
                  <StatusBadge status={next.b.paymentStatus} label={`Pagamento: ${PAYMENT_STATUS_LABEL[next.b.paymentStatus]}`} dark />
                </div>
                <div className="flex flex-wrap gap-3 md:justify-end">
                  <Link href={`/agendar/confirmacao/${next.b.id}`} className={buttonVariants({ variant: "light" })}>Ver detalhes</Link>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-10 rounded-[28px] border border-dashed border-border bg-card p-10 text-center">
            <p className="font-display text-3xl text-petrol">Nenhum horário marcado</p>
            <p className="mt-2 text-muted-foreground">Escolha um serviço e veja na hora os horários livres.</p>
            <Link href="/agendar" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>Agendar horário</Link>
          </section>
        )}

        <div className="mt-14 grid gap-12 lg:grid-cols-12">
          <div className="space-y-14 lg:col-span-8">
            {/* Agendamentos futuros */}
            <section aria-labelledby="futuros">
              <h2 id="futuros" className="font-display text-3xl text-petrol">Agendamentos futuros</h2>
              {upcoming.length === 0 ? (
                <p className="mt-4 text-muted-foreground">Você não tem outros agendamentos futuros.</p>
              ) : (
                <ul className="mt-6 space-y-4">
                  {upcoming.map(({ b, pro }) => (
                    <li key={b.id} className="rounded-[22px] border border-border bg-card p-5 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-display text-2xl text-petrol">{b.serviceName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{fmtWeekday(b.startsAt)}, {fmtDate(b.startsAt)} · {fmtTime(b.startsAt)} · {fmtDuration(b.durationMin)} · com {pro}</p>
                          <p className="mt-1 text-sm text-muted-foreground">Código <span className="font-mono tracking-wider">{b.code}</span> · {formatBRL(b.priceCents)} · {PAYMENT_METHOD_LABEL[b.paymentMethod]}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} />
                          <StatusBadge status={b.paymentStatus} label={PAYMENT_STATUS_LABEL[b.paymentStatus]} />
                        </div>
                      </div>
                      <BookingActions
                        booking={{ id: b.id, serviceId: b.serviceId, professionalId: b.professionalId, startsAt: b.startsAt.toISOString(), status: b.status, hoursLeft: (b.startsAt.getTime() - now.getTime()) / 3_600_000 }}
                        policy={policy}
                        whatsapp={s.whatsapp}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Histórico */}
            <section aria-labelledby="historico">
              <h2 id="historico" className="font-display text-3xl text-petrol">Histórico de atendimentos</h2>
              {history.length === 0 ? (
                <p className="mt-4 text-muted-foreground">Seu histórico aparecerá aqui depois do primeiro atendimento.</p>
              ) : (
                <ul className="mt-6 divide-y divide-border rounded-[22px] border border-border bg-card">
                  {history.map(({ b, pro }) => (
                    <li key={b.id} className="p-5 sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-graphite">{b.serviceName} <span className="font-normal text-muted-foreground">com {pro}</span></p>
                          <p className="text-sm text-muted-foreground">{fmtDate(b.startsAt)} às {fmtTime(b.startsAt)} · {formatBRL(b.priceCents)} · cód. {b.code}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} />
                          <StatusBadge status={b.paymentStatus} label={PAYMENT_STATUS_LABEL[b.paymentStatus]} />
                        </div>
                      </div>
                      {b.status === "completed" && !reviewedSet.has(b.id) && <TestimonialForm bookingId={b.id} />}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Pagamentos */}
            <section aria-labelledby="pagamentos">
              <h2 id="pagamentos" className="font-display text-3xl text-petrol">Pagamentos</h2>
              {pays.length === 0 ? (
                <p className="mt-4 text-muted-foreground">Nenhum pagamento registrado ainda.</p>
              ) : (
                <div className="mt-6 overflow-x-auto rounded-[22px] border border-border bg-card">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-5 py-3 font-medium">Agendamento</th>
                        <th className="px-5 py-3 font-medium">Meio</th>
                        <th className="px-5 py-3 font-medium">Data</th>
                        <th className="px-5 py-3 font-medium">Valor</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pays.map((p) => {
                        const b = list.find((l) => l.b.id === p.bookingId)?.b;
                        return (
                          <tr key={p.id} className="border-b border-border last:border-0">
                            <td className="px-5 py-3.5">{b?.serviceName}<span className="block font-mono text-xs text-muted-foreground">{b?.code}</span></td>
                            <td className="px-5 py-3.5">{p.provider === "manual" ? "Presencial" : "Mercado Pago"}{p.method && <span className="block text-xs text-muted-foreground">{TX_METHOD_LABEL[p.method] ?? p.method}</span>}</td>
                            <td className="px-5 py-3.5">{fmtDateTime(p.paidAt ?? p.createdAt)}</td>
                            <td className="px-5 py-3.5 font-medium">{formatBRL(p.paidAmountCents ?? p.amountCents)}</td>
                            <td className="px-5 py-3.5"><StatusBadge status={p.status} label={PAYMENT_TX_LABEL[p.status]} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-8 lg:col-span-4">
            <section aria-labelledby="avisos" className="rounded-[22px] border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 id="avisos" className="font-display text-2xl text-petrol">Avisos {unread > 0 && <span className="ml-1 rounded-full bg-cherry px-2 py-0.5 align-middle font-sans text-xs text-white">{unread}</span>}</h2>
                {unread > 0 && <MarkReadButton />}
              </div>
              {notes.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nenhum aviso por enquanto.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {notes.map((n) => (
                    <li key={n.id} className={cn("border-l-2 pl-3", n.readAt ? "border-border" : "border-cherry")}>
                      <p className="text-sm font-semibold text-graphite">{n.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="dados" className="rounded-[22px] border border-border bg-card p-6">
              <h2 id="dados" className="font-display text-2xl text-petrol">Informações pessoais</h2>
              <ProfileForm name={u.name} email={u.email} phone={u.phone ?? ""} />
            </section>

            <DangerZone email={u.email} isClient={u.role === "client"} />
          </aside>
        </div>
      </div>
    </div>
  );
}
