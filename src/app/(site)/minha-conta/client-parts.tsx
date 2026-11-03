"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ptBR } from "date-fns/locale";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { authClient } from "@/lib/auth-client";
import { whatsappLink } from "@/lib/media-url";
import { cn } from "@/lib/utils";
import {
  cancelMyBookingAction,
  deleteMyAccountAction,
  markNotificationsReadAction,
  rescheduleMyBookingAction,
  submitTestimonialAction,
  updateProfileAction,
} from "./actions";

type Policy = { allowCancel: boolean; allowReschedule: boolean; cancelMinHours: number; rescheduleMinHours: number };

const pad = (n: number) => String(n).padStart(2, "0");
const dateToYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function BookingActions({
  booking,
  policy,
  whatsapp,
}: {
  booking: { id: string; serviceId: string | null; professionalId: string; startsAt: string; status: string; hoursLeft: number };
  policy: Policy;
  whatsapp: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const hoursLeft = booking.hoursLeft;
  const canCancel = policy.allowCancel && (booking.status === "pending_payment" || hoursLeft >= policy.cancelMinHours);
  const canReschedule = policy.allowReschedule && booking.serviceId && booking.status !== "pending_payment" && hoursLeft >= policy.rescheduleMinHours;
  const wa = whatsappLink(whatsapp, "Olá! Preciso de ajuda com meu agendamento.");

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
      {booking.status === "pending_payment" && (
        <Button size="sm" onClick={() => router.push(`/agendar/confirmacao/${booking.id}`)}>Concluir pagamento</Button>
      )}
      {canReschedule && (
        <Button size="sm" variant="outline" onClick={() => setResOpen(true)}>Reagendar</Button>
      )}
      {canCancel &&
        (confirmCancel ? (
          <span className="flex flex-wrap items-center gap-2 rounded-full bg-blush-veil px-3 py-1.5 text-sm text-merlot">
            Cancelar mesmo?
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await cancelMyBookingAction(booking.id);
                  if (!r.ok) toast.error(r.error);
                  else toast.success("Agendamento cancelado.");
                  setConfirmCancel(false);
                  router.refresh();
                })
              }
            >
              {pending && <Loader2 className="size-3.5 animate-spin" />} Sim, cancelar
            </Button>
            <button className="text-sm underline" onClick={() => setConfirmCancel(false)}>Manter</button>
          </span>
        ) : (
          <Button size="sm" variant="ghost" className="text-merlot" onClick={() => setConfirmCancel(true)}>Cancelar</Button>
        ))}
      {(!canCancel || !canReschedule) && (
        <p className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
          {!policy.allowCancel || !policy.allowReschedule
            ? "Alterações são feitas diretamente com o estúdio."
            : `Alterações online até ${Math.min(policy.cancelMinHours, policy.rescheduleMinHours)}h antes.`}{" "}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="text-teal underline">Falar com o estúdio</a>
          )}
        </p>
      )}
      {resOpen && booking.serviceId && (
        <RescheduleDialog bookingId={booking.id} serviceId={booking.serviceId} professionalId={booking.professionalId} onClose={() => setResOpen(false)} />
      )}
    </div>
  );
}

function RescheduleDialog({ bookingId, serviceId, professionalId, onClose }: { bookingId: string; serviceId: string; professionalId: string; onClose: () => void }) {
  const router = useRouter();
  const [month, setMonth] = useState(new Date());
  const [dates, setDates] = useState<Set<string>>(new Set());
  const [ymd, setYmd] = useState<string>();
  const [slots, setSlots] = useState<{ startMin: number; label: string }[] | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const from = new Date(month.getFullYear(), month.getMonth(), 1);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    fetch(`/api/disponibilidade?servico=${serviceId}&profissional=${professionalId}&de=${dateToYmd(from)}&ate=${dateToYmd(to)}`)
      .then((r) => r.json())
      .then((j) => setDates(new Set(j.dates ?? [])))
      .catch(() => toast.error("Não foi possível carregar a agenda."));
  }, [month, serviceId, professionalId]);

  useEffect(() => {
    if (!ymd) return;
    setSlots(null);
    fetch(`/api/disponibilidade?servico=${serviceId}&profissional=${professionalId}&data=${ymd}`)
      .then((r) => r.json())
      .then((j) => setSlots(j.slots ?? []))
      .catch(() => setSlots([]));
  }, [ymd, serviceId, professionalId]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-petrol">Reagendar</DialogTitle>
          <DialogDescription>Escolha um novo dia e horário com a mesma profissional. O horário é conferido novamente antes de salvar.</DialogDescription>
        </DialogHeader>
        <Calendar
          mode="single"
          locale={ptBR}
          month={month}
          onMonthChange={setMonth}
          startMonth={today}
          showOutsideDays={false}
          selected={ymd ? new Date(`${ymd}T12:00:00`) : undefined}
          onSelect={(d) => d && setYmd(dateToYmd(d))}
          disabled={(d) => d < today || !dates.has(dateToYmd(d))}
          className="mx-auto p-0 [--cell-size:--spacing(10)]"
        />
        {ymd && (
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Novos horários">
            {!slots ? (
              <p className="col-span-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando horários…</p>
            ) : slots.length === 0 ? (
              <p className="col-span-4 text-sm text-muted-foreground">Sem horários neste dia.</p>
            ) : (
              slots.map((s) => (
                <button
                  key={s.startMin}
                  role="radio"
                  aria-checked={false}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await rescheduleMyBookingAction(bookingId, ymd, s.startMin);
                      if (!r.ok) return void toast.error(r.error);
                      toast.success("Agendamento remarcado!");
                      onClose();
                      router.refresh();
                    })
                  }
                  className="h-11 rounded-full border border-border text-sm font-medium text-petrol hover:border-merlot hover:bg-merlot hover:text-white"
                >
                  {s.label}
                </button>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ProfileForm({ name, email, phone }: { name: string; email: string; phone: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pwOpen, setPwOpen] = useState(false);
  return (
    <>
      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const r = await updateProfileAction({ name: String(fd.get("name")), phone: String(fd.get("phone")) });
            if (!r.ok) toast.error(r.error);
            else toast.success("Dados atualizados.");
            router.refresh();
          });
        }}
      >
        <Field id="pf-name" label="Nome completo"><Input id="pf-name" name="name" defaultValue={name} required autoComplete="name" /></Field>
        <Field id="pf-email" label="E-mail" hint="Para alterar o e-mail, fale com o estúdio."><Input id="pf-email" value={email} disabled readOnly /></Field>
        <Field id="pf-phone" label="Celular"><Input id="pf-phone" name="phone" defaultValue={phone} type="tel" required autoComplete="tel" /></Field>
        <Button type="submit" variant="teal" disabled={pending} className="w-full">{pending && <Loader2 className="size-4 animate-spin" />} Salvar dados</Button>
      </form>
      <button type="button" onClick={() => setPwOpen((v) => !v)} className="mt-4 text-sm text-teal underline underline-offset-4">Alterar senha</button>
      {pwOpen && <PasswordForm onDone={() => setPwOpen(false)} />}
    </>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [pending, setPending] = useState(false);
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const newPassword = String(fd.get("new"));
        if (newPassword.length < 8) return void toast.error("A nova senha precisa de pelo menos 8 caracteres.");
        setPending(true);
        const { error } = await authClient.changePassword({ currentPassword: String(fd.get("current")), newPassword, revokeOtherSessions: true });
        setPending(false);
        if (error) return void toast.error(error.code === "INVALID_PASSWORD" ? "Senha atual incorreta." : "Não foi possível alterar a senha.");
        toast.success("Senha alterada.");
        onDone();
      }}
    >
      <Field id="pw-current" label="Senha atual"><Input id="pw-current" name="current" type="password" autoComplete="current-password" required /></Field>
      <Field id="pw-new" label="Nova senha"><Input id="pw-new" name="new" type="password" autoComplete="new-password" required /></Field>
      <Button type="submit" variant="outline" disabled={pending} className="w-full">{pending && <Loader2 className="size-4 animate-spin" />} Salvar nova senha</Button>
    </form>
  );
}

export function TestimonialForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 text-sm font-semibold text-merlot underline underline-offset-4">
        Contar como foi a experiência
      </button>
    );
  }
  return (
    <form
      className="mt-4 space-y-3 rounded-2xl bg-paper p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const text = String(new FormData(e.currentTarget).get("text"));
        start(async () => {
          const r = await submitTestimonialAction(bookingId, text, rating);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Obrigada! Seu depoimento será publicado após a revisão do estúdio.");
          router.refresh();
        });
      }}
    >
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Nota">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} de 5`} onClick={() => setRating(n)}>
            <Star className={cn("size-6", n <= rating ? "fill-cherry text-cherry" : "text-border")} />
          </button>
        ))}
      </div>
      <Textarea name="text" rows={3} maxLength={800} required placeholder="Como foi seu atendimento?" />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="size-3.5 animate-spin" />} Enviar depoimento</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </form>
  );
}

export function MarkReadButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { await markNotificationsReadAction(); router.refresh(); })}
      className="text-xs text-teal underline underline-offset-2"
    >
      Marcar como lidos
    </button>
  );
}

export function DangerZone({ email, isClient }: { email: string; isClient: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <section aria-labelledby="privacidade" className="rounded-[22px] border border-border bg-card p-6">
      <h2 id="privacidade" className="font-display text-2xl text-petrol">Privacidade</h2>
      <p className="mt-2 text-sm text-muted-foreground">Você pode baixar uma cópia dos seus dados ou excluir sua conta a qualquer momento (LGPD).</p>
      <a href="/api/minha-conta/dados" className="mt-4 inline-block text-sm font-semibold text-teal underline underline-offset-4">Baixar meus dados (JSON)</a>
      {isClient && (
        <div className="mt-4">
          {!open ? (
            <button onClick={() => setOpen(true)} className="text-sm text-merlot underline underline-offset-4">Excluir minha conta</button>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const typed = String(new FormData(e.currentTarget).get("confirm"));
                start(async () => {
                  const r = await deleteMyAccountAction(typed);
                  if (!r.ok) return void toast.error(r.error);
                  await authClient.signOut().catch(() => undefined);
                  window.location.href = "/";
                });
              }}
            >
              <p className="text-sm text-merlot">Esta ação é definitiva. Digite <strong>{email}</strong> para confirmar.</p>
              <Input name="confirm" autoComplete="off" required />
              <Button type="submit" variant="destructive" size="sm" disabled={pending}>{pending && <Loader2 className="size-3.5 animate-spin" />} Excluir definitivamente</Button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
