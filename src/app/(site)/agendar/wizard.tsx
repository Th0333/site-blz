"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Check, Clock, CreditCard, Loader2, Store, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import type { PublicProfessional, PublicService } from "@/server/public-data";
import { Calendar } from "@/components/ui/calendar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Photo } from "@/components/site/photo";
import { SwatchStroke } from "@/components/site/swatch";
import { formatBRL } from "@/lib/money";
import { fmtDuration, fmtYmdLong, hhmm } from "@/lib/time";
import { cn } from "@/lib/utils";
import { confirmBookingAction } from "./actions";

type Options = {
  allowAny: boolean;
  onlineAvailable: boolean;
  inPersonAvailable: boolean;
  holdMinutes: number;
  maxDaysAhead: number;
  cancellationPolicy: string;
  cancelMinHours: number;
};
type Initial = { serviceId?: string; professionalId?: string; ymd?: string; startMin?: number };

const STEPS = ["Serviço", "Profissional", "Data", "Horário", "Pagamento"] as const;
const EASE = [0.22, 1, 0.36, 1] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const dateToYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ymdToDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function BookingWizard({
  services,
  pros,
  user,
  options,
  initial,
}: {
  services: PublicService[];
  pros: PublicProfessional[];
  user: { name: string } | null;
  options: Options;
  initial: Initial;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const validService = services.find((s) => s.id === initial.serviceId);
  const proValid = (sid?: string, pid?: string) => {
    if (!pid) return false;
    if (pid === "any") return options.allowAny;
    const svc = services.find((s) => s.id === sid);
    return svc ? svc.professionalIds.includes(pid) : pros.some((p) => p.id === pid);
  };

  const [serviceId, setServiceId] = useState<string | undefined>(validService?.id);
  const [professionalId, setProfessionalId] = useState<string | undefined>(proValid(initial.serviceId, initial.professionalId) ? initial.professionalId : undefined);
  const [ymd, setYmd] = useState<string | undefined>(validService ? initial.ymd : undefined);
  const [startMin, setStartMin] = useState<number | undefined>(validService && initial.ymd ? initial.startMin : undefined);
  const firstIncomplete = !serviceId ? 0 : !professionalId ? 1 : !ymd ? 2 : startMin === undefined ? 3 : 4;
  const [step, setStep] = useState(firstIncomplete);
  const [payment, setPayment] = useState<"in_person" | "online" | undefined>(
    options.onlineAvailable && !options.inPersonAvailable ? "online" : !options.onlineAvailable && options.inPersonAvailable ? "in_person" : undefined,
  );
  const [notes, setNotes] = useState("");
  const [submitting, startSubmit] = useTransition();

  const service = services.find((s) => s.id === serviceId);
  const pro = pros.find((p) => p.id === professionalId);
  const filterPro = !serviceId && initial.professionalId ? pros.find((p) => p.id === initial.professionalId) : undefined;
  const serviceList = filterPro ? services.filter((s) => s.professionalIds.includes(filterPro.id)) : services;
  const prosForService = service ? pros.filter((p) => service.professionalIds.includes(p.id)) : [];

  // Mantém as escolhas na URL: sobrevivem ao login/cadastro e ao recarregar a página
  useEffect(() => {
    const p = new URLSearchParams();
    if (serviceId) p.set("servico", serviceId);
    if (professionalId) p.set("profissional", professionalId);
    if (ymd) p.set("data", ymd);
    if (startMin !== undefined) p.set("hora", String(startMin));
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `/agendar?${qs}` : "/agendar");
  }, [serviceId, professionalId, ymd, startMin]);

  const goto = (i: number) => {
    setStep(i);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  /* ---------------------------- Datas e horários ---------------------------- */
  const [month, setMonth] = useState<Date>(() => (ymd ? ymdToDate(ymd) : new Date()));
  const [available, setAvailable] = useState<Set<string>>(new Set());
  const [loadingDates, setLoadingDates] = useState(false);
  const [slots, setSlots] = useState<{ startMin: number; label: string }[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const loadDates = useCallback(async () => {
    if (!serviceId || !professionalId) return;
    const from = new Date(month.getFullYear(), month.getMonth(), 1);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    setLoadingDates(true);
    try {
      const r = await fetch(`/api/disponibilidade?servico=${serviceId}&profissional=${professionalId}&de=${dateToYmd(from)}&ate=${dateToYmd(to)}`, { cache: "no-store" });
      const j = await r.json();
      setAvailable(new Set(j.dates ?? []));
    } catch {
      toast.error("Não conseguimos carregar o calendário. Verifique sua conexão.");
    } finally {
      setLoadingDates(false);
    }
  }, [serviceId, professionalId, month]);

  const loadSlots = useCallback(async () => {
    if (!serviceId || !professionalId || !ymd) return;
    setLoadingSlots(true);
    setSlots(null);
    try {
      const r = await fetch(`/api/disponibilidade?servico=${serviceId}&profissional=${professionalId}&data=${ymd}`, { cache: "no-store" });
      const j = await r.json();
      setSlots(j.slots ?? []);
    } catch {
      toast.error("Não conseguimos carregar os horários. Tente novamente.");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [serviceId, professionalId, ymd]);

  useEffect(() => {
    if (step === 2) void loadDates();
  }, [step, loadDates]);
  useEffect(() => {
    if (step === 3 || (step === 4 && startMin !== undefined)) void loadSlots();
  }, [step, loadSlots, startMin]);

  // Se o horário guardado (ex.: após login) não estiver mais livre, volta para a escolha de horário
  useEffect(() => {
    if (step === 4 && slots && startMin !== undefined && !slots.some((s) => s.startMin === startMin)) {
      toast.warning("O horário escolhido não está mais disponível. Escolha outro, por favor.");
      setStartMin(undefined);
      setStep(3);
    }
  }, [step, slots, startMin]);

  const periods = useMemo(() => {
    const list = slots ?? [];
    return [
      { label: "Manhã", items: list.filter((s) => s.startMin < 12 * 60) },
      { label: "Tarde", items: list.filter((s) => s.startMin >= 12 * 60 && s.startMin < 18 * 60) },
      { label: "Noite", items: list.filter((s) => s.startMin >= 18 * 60) },
    ].filter((p) => p.items.length);
  }, [slots]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDay = new Date(today);
  lastDay.setDate(lastDay.getDate() + options.maxDaysAhead);

  const nextUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (serviceId) p.set("servico", serviceId);
    if (professionalId) p.set("profissional", professionalId);
    if (ymd) p.set("data", ymd);
    if (startMin !== undefined) p.set("hora", String(startMin));
    return `/agendar?${p.toString()}`;
  }, [serviceId, professionalId, ymd, startMin]);

  function submit() {
    if (!service || !professionalId || !ymd || startMin === undefined || !payment) return;
    startSubmit(async () => {
      const r = await confirmBookingAction({ serviceId: service.id, professionalId, ymd, startMin, paymentMethod: payment, notes: notes || undefined });
      if (!r.ok) {
        toast.error(r.error);
        if (/indisponível|reservado/i.test(r.error)) {
          setStartMin(undefined);
          goto(3);
          void loadSlots();
        }
        return;
      }
      if (r.data.checkoutUrl) {
        toast.success("Reserva criada! Redirecionando para o pagamento seguro…");
        window.location.href = r.data.checkoutUrl;
        return;
      }
      if ("checkoutError" in r.data && r.data.checkoutError) toast.error(r.data.checkoutError);
      router.push(`/agendar/confirmacao/${r.data.bookingId}`);
    });
  }

  /* --------------------------------- Render --------------------------------- */
  const panel = {
    initial: reduce ? false : { opacity: 0, x: 24, filter: "blur(4px)" },
    animate: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: reduce ? undefined : { opacity: 0, x: -24, filter: "blur(4px)" },
    transition: { duration: 0.45, ease: EASE },
  } as const;

  return (
    <div>
      <header className="mb-10">
        <p className="eyebrow text-teal">Agendamento online</p>
        <h1 className="display mt-3 text-[clamp(2.5rem,6vw,4.4rem)] text-petrol">
          Reserve seu <span className="italic text-merlot">momento</span>
        </h1>
        <Progress step={step} maxReachable={firstIncomplete} onGo={goto} />
      </header>

      <div className="grid gap-10 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <AnimatePresence mode="wait" initial={false}>
            {step === 0 && (
              <motion.section key="s0" {...panel} aria-labelledby="t0">
                <StepTitle id="t0" title="Qual serviço você deseja?" hint={filterPro ? `Serviços realizados por ${filterPro.displayName}.` : undefined} />
                {serviceList.length === 0 ? (
                  <Empty text="Nenhum serviço disponível para agendamento online no momento." />
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {serviceList.map((s, i) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          aria-pressed={serviceId === s.id}
                          onClick={() => {
                            setServiceId(s.id);
                            const keepPro = professionalId && (professionalId === "any" ? options.allowAny : s.professionalIds.includes(professionalId));
                            if (!keepPro) setProfessionalId(filterPro && s.professionalIds.includes(filterPro.id) ? filterPro.id : undefined);
                            setYmd(undefined);
                            setStartMin(undefined);
                            goto(keepPro || (filterPro && s.professionalIds.includes(filterPro.id)) ? 2 : 1);
                          }}
                          className={cn(
                            "group flex w-full gap-4 rounded-2xl border bg-card p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-18px_rgba(5,47,50,0.45)]",
                            serviceId === s.id ? "border-merlot ring-2 ring-merlot/25" : "border-border",
                          )}
                        >
                          <Photo src={s.photo} alt="" className="aspect-[3/4] w-24 shrink-0 rounded-xl" sizes="96px" fallbackVariant={i} />
                          <span className="flex min-w-0 flex-1 flex-col py-1 pr-1">
                            <span className="eyebrow text-[0.62rem] text-teal">{s.category}</span>
                            <span className="mt-1 font-display text-[1.45rem] leading-tight text-petrol">{s.name}</span>
                            <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</span>
                            <span className="mt-auto flex items-center justify-between pt-3 text-sm">
                              <span className="flex items-center gap-1 text-teal-deep"><Clock className="size-3.5" />{fmtDuration(s.durationMin)}</span>
                              <span className="font-semibold text-graphite">{s.priceFrom && <span className="font-normal text-muted-foreground">a partir de </span>}{formatBRL(s.priceCents)}</span>
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.section>
            )}

            {step === 1 && service && (
              <motion.section key="s1" {...panel} aria-labelledby="t1">
                <StepTitle id="t1" title="Com quem você gostaria de ser atendida?" back={() => goto(0)} />
                {prosForService.length === 0 ? (
                  <Empty text="Nenhuma profissional está atendendo este serviço no momento." />
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {options.allowAny && prosForService.length > 1 && (
                      <li>
                        <ChoiceCard
                          selected={professionalId === "any"}
                          onClick={() => {
                            setProfessionalId("any");
                            setYmd(undefined);
                            setStartMin(undefined);
                            goto(2);
                          }}
                          media={<div className="grid aspect-square w-20 place-items-center rounded-xl bg-teal-mist text-teal"><Sparkles className="size-7" /></div>}
                          title="Qualquer profissional disponível"
                          text="Mostramos todos os horários livres da equipe para este serviço."
                        />
                      </li>
                    )}
                    {prosForService.map((p, i) => (
                      <li key={p.id}>
                        <ChoiceCard
                          selected={professionalId === p.id}
                          onClick={() => {
                            setProfessionalId(p.id);
                            setYmd(undefined);
                            setStartMin(undefined);
                            goto(2);
                          }}
                          media={<Photo src={p.photo} alt="" className="aspect-square w-20 shrink-0 rounded-xl" sizes="80px" fallbackVariant={i + 1} />}
                          title={p.displayName}
                          eyebrow={p.specialties.slice(0, 2).join(" · ")}
                          text={p.bio}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </motion.section>
            )}

            {step === 2 && service && professionalId && (
              <motion.section key="s2" {...panel} aria-labelledby="t2">
                <StepTitle id="t2" title="Escolha o dia" hint="Dias em destaque têm horários livres." back={() => goto(1)} />
                <div className="relative rounded-[24px] border border-border bg-card p-3 sm:p-6">
                  {loadingDates && (
                    <div className="absolute right-5 top-5 flex items-center gap-2 text-xs text-muted-foreground" role="status">
                      <Loader2 className="size-3.5 animate-spin" /> Consultando agenda…
                    </div>
                  )}
                  <Calendar
                    mode="single"
                    locale={ptBR}
                    month={month}
                    onMonthChange={setMonth}
                    startMonth={today}
                    endMonth={lastDay}
                    showOutsideDays={false}
                    selected={ymd ? ymdToDate(ymd) : undefined}
                    onSelect={(d) => {
                      if (!d) return;
                      setYmd(dateToYmd(d));
                      setStartMin(undefined);
                      goto(3);
                    }}
                    disabled={(d) => loadingDates || d < today || d > lastDay || !available.has(dateToYmd(d))}
                    modifiers={{ available: (d) => available.has(dateToYmd(d)) }}
                    modifiersClassNames={{ available: "[&>button]:font-semibold [&>button]:text-petrol [&>button]:bg-teal-mist/70" }}
                    className="w-full bg-transparent p-0 [--cell-size:--spacing(11)] sm:[--cell-size:--spacing(14)]"
                    classNames={{ root: "w-full", month: "w-full gap-5", month_caption: "flex h-11 items-center justify-center font-display text-2xl capitalize text-petrol", weekday: "flex-1 text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground" }}
                  />
                  {!loadingDates && available.size === 0 && (
                    <p className="mt-4 rounded-xl bg-blush-veil px-4 py-3 text-sm text-merlot">
                      Sem horários livres neste mês. Avance para o próximo mês{options.allowAny && professionalId !== "any" ? " ou experimente “Qualquer profissional disponível”" : ""}.
                    </p>
                  )}
                </div>
              </motion.section>
            )}

            {step === 3 && service && professionalId && ymd && (
              <motion.section key="s3" {...panel} aria-labelledby="t3">
                <StepTitle id="t3" title="Escolha o horário" hint={fmtYmdLong(ymd)} back={() => goto(2)} />
                {loadingSlots || !slots ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5" role="status" aria-label="Carregando horários">
                    {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-full" />)}
                  </div>
                ) : slots.length === 0 ? (
                  <Empty text="Os horários deste dia acabaram de ser preenchidos. Escolha outra data." action={<Button variant="outline" onClick={() => goto(2)}>Escolher outra data</Button>} />
                ) : (
                  <div className="space-y-8">
                    {periods.map((p) => (
                      <fieldset key={p.label}>
                        <legend className="eyebrow mb-3 text-muted-foreground">{p.label}</legend>
                        <div role="radiogroup" aria-label={`Horários — ${p.label}`} className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-6">
                          {p.items.map((s) => {
                            const sel = startMin === s.startMin;
                            return (
                              <button
                                key={s.startMin}
                                type="button"
                                role="radio"
                                aria-checked={sel}
                                onClick={() => {
                                  setStartMin(s.startMin);
                                  goto(4);
                                }}
                                className={cn(
                                  "relative h-12 rounded-full border text-[0.95rem] font-medium tabular-nums transition-colors",
                                  sel ? "border-transparent text-white" : "border-border bg-card text-petrol hover:border-teal hover:text-teal",
                                )}
                              >
                                {sel && <motion.span layoutId="slot-pill" transition={{ type: "spring", duration: 0.35, bounce: 0 }} className="absolute inset-0 rounded-full bg-merlot" />}
                                <span className="relative">{s.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                )}
              </motion.section>
            )}

            {step === 4 && service && professionalId && ymd && startMin !== undefined && (
              <motion.section key="s4" {...panel} aria-labelledby="t4">
                <StepTitle id="t4" title="Como prefere pagar?" back={() => goto(3)} />
                {!user ? (
                  <div className="rounded-[24px] border border-border bg-card p-6 sm:p-8">
                    <UserRound className="size-8 text-teal" aria-hidden />
                    <h3 className="mt-4 font-display text-3xl text-petrol">Falta só identificar você</h3>
                    <p className="mt-2 max-w-md text-muted-foreground">
                      Para concluir, entre na sua conta ou crie uma agora. Suas escolhas ficam guardadas e o horário é conferido de novo antes da confirmação.
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <Link href={`/cadastro?next=${encodeURIComponent(nextUrl)}`} className={buttonVariants({ size: "lg" })}>Criar conta</Link>
                      <Link href={`/entrar?next=${encodeURIComponent(nextUrl)}`} className={buttonVariants({ variant: "outline", size: "lg" })}>Já tenho conta</Link>
                    </div>
                  </div>
                ) : !options.onlineAvailable && !options.inPersonAvailable ? (
                  <Empty text="O estúdio está ajustando as formas de pagamento. Fale com a gente pelo WhatsApp para reservar." />
                ) : (
                  <div className="space-y-4">
                    <div role="radiogroup" aria-label="Forma de pagamento" className="grid gap-4 md:grid-cols-2">
                      {options.inPersonAvailable && (
                        <PayOption
                          selected={payment === "in_person"}
                          onSelect={() => setPayment("in_person")}
                          icon={<Store className="size-5" />}
                          title="Pagar no dia do atendimento"
                          text="Prefere acertar pessoalmente? Reserve seu horário e realize o pagamento no dia do atendimento."
                        />
                      )}
                      {options.onlineAvailable && (
                        <PayOption
                          selected={payment === "online"}
                          onSelect={() => setPayment("online")}
                          icon={<CreditCard className="size-5" />}
                          title="Pagar agora com Mercado Pago"
                          text={`Garanta seu agendamento e realize o pagamento online com segurança. Cartão, Pix e outros meios habilitados. Seu horário fica reservado por ${options.holdMinutes} minutos enquanto você paga.`}
                        />
                      )}
                    </div>
                    <label className="block pt-2">
                      <span className="text-sm font-medium text-graphite">Observações para a profissional <span className="font-normal text-muted-foreground">(opcional)</span></span>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3} className="mt-2" placeholder="Ex.: tenho pele sensível, evento às 20h, referência de maquiagem…" />
                    </label>
                    {(options.cancellationPolicy || options.cancelMinHours > 0) && (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        <strong className="font-semibold text-graphite">Política de cancelamento: </strong>
                        {options.cancellationPolicy || `cancelamentos e remarcações pelo site até ${options.cancelMinHours}h antes do horário.`}
                      </p>
                    )}
                    <Button size="lg" className="w-full sm:w-auto" disabled={!payment || submitting} onClick={submit}>
                      {submitting && <Loader2 className="size-4 animate-spin" />}
                      {payment === "online" ? "Reservar e ir para o pagamento" : "Confirmar agendamento"}
                    </Button>
                  </div>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        <aside className="lg:col-span-4">
          <Summary service={service} pro={professionalId === "any" ? "any" : pro} ymd={ymd} startMin={startMin} onEdit={goto} />
        </aside>
      </div>
    </div>
  );
}

function Progress({ step, maxReachable, onGo }: { step: number; maxReachable: number; onGo: (i: number) => void }) {
  return (
    <nav aria-label="Etapas do agendamento" className="mt-8">
      <ol className="grid grid-cols-5 gap-2 sm:gap-4">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          const reachable = i <= Math.max(maxReachable, step);
          return (
            <li key={label}>
              <button
                type="button"
                disabled={!reachable || current}
                onClick={() => onGo(i)}
                aria-current={current ? "step" : undefined}
                className="group w-full text-left disabled:cursor-default"
              >
                <SwatchStroke
                  color={done ? "var(--brand-cherry)" : current ? "var(--brand-teal)" : "var(--brand-teal-haze)"}
                  filled={done || current}
                  className="h-4 w-full transition-opacity group-enabled:group-hover:opacity-80"
                />
                <span className={cn("mt-1.5 truncate text-[0.7rem] font-semibold uppercase tracking-[0.14em] sm:block sm:text-xs", current ? "block text-teal-deep" : done ? "sr-only text-merlot sm:not-sr-only" : "sr-only text-muted-foreground sm:not-sr-only")}>
                  <span className="sr-only">Etapa {i + 1}: </span>
                  {label}
                  {done && <span className="sr-only"> (concluída)</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepTitle({ id, title, hint, back }: { id: string; title: string; hint?: React.ReactNode; back?: () => void }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      {back && (
        <button type="button" onClick={back} aria-label="Voltar para a etapa anterior" className="mt-1 grid size-10 shrink-0 place-items-center rounded-full border border-border bg-card text-petrol hover:bg-teal-mist">
          <ArrowLeft className="size-4" />
        </button>
      )}
      <div>
        <h2 id={id} className="font-display text-[2rem] leading-tight text-petrol">{title}</h2>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function ChoiceCard({ selected, onClick, media, title, text, eyebrow }: { selected: boolean; onClick: () => void; media: React.ReactNode; title: string; text?: string; eyebrow?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border bg-card p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-18px_rgba(5,47,50,0.45)]",
        selected ? "border-merlot ring-2 ring-merlot/25" : "border-border",
      )}
    >
      {media}
      <span className="min-w-0">
        {eyebrow && <span className="eyebrow block text-[0.62rem] text-teal">{eyebrow}</span>}
        <span className="block font-display text-[1.45rem] leading-tight text-petrol">{title}</span>
        {text && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{text}</span>}
      </span>
    </button>
  );
}

function PayOption({ selected, onSelect, icon, title, text }: { selected: boolean; onSelect: () => void; icon: React.ReactNode; title: string; text: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex h-full flex-col rounded-[22px] border p-6 text-left transition-all duration-300",
        selected ? "border-merlot bg-blush-veil/60 ring-2 ring-merlot/25" : "border-border bg-card hover:border-teal",
      )}
    >
      <span className={cn("grid size-10 place-items-center rounded-full", selected ? "bg-merlot text-white" : "bg-teal-mist text-teal")}>{icon}</span>
      <span className="mt-4 font-display text-[1.5rem] leading-tight text-petrol">{title}</span>
      <span className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</span>
      {selected && (
        <span className="absolute right-5 top-5 grid size-6 place-items-center rounded-full bg-merlot text-white">
          <Check className="size-3.5" />
        </span>
      )}
    </button>
  );
}

function Summary({ service, pro, ymd, startMin, onEdit }: { service?: PublicService; pro?: PublicProfessional | "any"; ymd?: string; startMin?: number; onEdit: (i: number) => void }) {
  const rows: Array<{ label: string; value: React.ReactNode; step: number }> = [
    { label: "Serviço", value: service?.name, step: 0 },
    { label: "Profissional", value: pro === "any" ? "Qualquer profissional disponível" : pro?.displayName, step: 1 },
    { label: "Data", value: ymd ? fmtYmdLong(ymd) : undefined, step: 2 },
    { label: "Horário", value: startMin !== undefined ? hhmm(startMin) : undefined, step: 3 },
  ];
  return (
    <div className="sticky top-28 overflow-hidden rounded-[26px] bg-petrol text-white grain">
      <div className="p-6">
        <p className="eyebrow text-teal-haze">Resumo</p>
        <dl className="mt-5 space-y-4">
          {rows.map((r) => (
            <div key={r.label} className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <dt className="text-sm text-[#a9c6c4]">{r.label}</dt>
              <dd className="text-right text-[0.95rem]">
                {r.value ?? <span className="text-[#6f9997]">—</span>}
                {r.value && (
                  <button type="button" onClick={() => onEdit(r.step)} className="ml-2 text-xs text-[#f3b6c0] underline underline-offset-2">
                    alterar
                  </button>
                )}
              </dd>
            </div>
          ))}
          {service && (
            <div className="flex items-center justify-between text-sm text-[#a9c6c4]">
              <dt>Duração</dt>
              <dd>{fmtDuration(service.durationMin)}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="flex items-end justify-between bg-wine-deep/70 px-6 py-5">
        <span className="text-sm text-[#e7c5cb]">Total</span>
        <span className="font-display text-3xl">{service ? formatBRL(service.priceCents) : "—"}</span>
      </div>
    </div>
  );
}

function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-dashed border-border bg-card p-8 text-center">
      <p className="mx-auto max-w-md text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
