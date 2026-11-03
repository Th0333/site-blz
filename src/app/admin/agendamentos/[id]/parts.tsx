"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { selectClass } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import {
  cancelAction,
  checkInAction,
  convertToInPersonAction,
  refundAction,
  registerPaymentAction,
  rescheduleAction,
  resolveReviewAction,
  saveAdminNotesAction,
  setStatusAction,
  syncPaymentAction,
} from "../actions";

type R = { ok: true } | { ok: false; error: string };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<R>, success: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(success);
      after?.();
      router.refresh();
    });
  return { pending, run };
}

export function BookingAdminActions({ booking, pros }: { booking: { id: string; status: string; checkedIn: boolean; ymd: string; time: string; professionalId: string }; pros: { id: string; name: string }[] }) {
  const { pending, run } = useRun();
  const [mode, setMode] = useState<"none" | "cancel" | "reschedule">("none");
  const active = ["scheduled", "confirmed"].includes(booking.status);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {booking.status === "scheduled" && <Button size="sm" variant="teal" disabled={pending} onClick={() => run(() => setStatusAction(booking.id, "confirmed"), "Atendimento confirmado.")}>Confirmar</Button>}
        {active && !booking.checkedIn && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => checkInAction(booking.id), "Chegada registrada.")}>Registrar chegada</Button>}
        {active && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setStatusAction(booking.id, "completed"), "Atendimento concluído.")}>Marcar concluído</Button>}
        {active && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setStatusAction(booking.id, "no_show"), "Registrado como não compareceu.")}>Não compareceu</Button>}
        {["completed", "no_show"].includes(booking.status) && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setStatusAction(booking.id, "scheduled"), "Status revertido para agendado.")}>Desfazer status</Button>}
        {booking.status === "pending_payment" && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => convertToInPersonAction(booking.id), "Convertido para pagamento no dia.")}>Converter para pagar no dia</Button>}
        {active && <Button size="sm" variant="outline" disabled={pending} onClick={() => setMode(mode === "reschedule" ? "none" : "reschedule")}>Reagendar</Button>}
        {(active || booking.status === "pending_payment") && <Button size="sm" variant="ghost" className="text-merlot" disabled={pending} onClick={() => setMode(mode === "cancel" ? "none" : "cancel")}>Cancelar</Button>}
      </div>

      {mode === "cancel" && (
        <form
          className="mt-4 space-y-3 rounded-xl bg-blush-veil/60 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = String(new FormData(e.currentTarget).get("reason"));
            run(() => cancelAction(booking.id, reason), "Agendamento cancelado.", () => setMode("none"));
          }}
        >
          <label className="block text-sm font-medium">Motivo do cancelamento<Input name="reason" required maxLength={300} className="mt-1" /></label>
          <p className="text-xs text-muted-foreground">A cliente recebe o aviso no sistema (e por e-mail, se configurado). Pagamentos aprovados não são estornados automaticamente.</p>
          <Button size="sm" variant="destructive" disabled={pending}>{pending && <Loader2 className="size-3.5 animate-spin" />} Confirmar cancelamento</Button>
        </form>
      )}

      {mode === "reschedule" && (
        <form
          className="mt-4 grid gap-3 rounded-xl bg-teal-mist/50 p-4 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => rescheduleAction(booking.id, String(fd.get("date")), String(fd.get("time")), String(fd.get("pro"))), "Reagendado.", () => setMode("none"));
          }}
        >
          <label className="text-sm">Nova data<Input name="date" type="date" defaultValue={booking.ymd} required className="mt-1" /></label>
          <label className="text-sm">Horário<Input name="time" type="time" defaultValue={booking.time} required className="mt-1" /></label>
          <label className="text-sm">Profissional
            <select name="pro" defaultValue={booking.professionalId} className={`${selectClass} mt-1`}>
              {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <div className="flex items-end"><Button size="sm" variant="teal" className="w-full" disabled={pending}>{pending && <Loader2 className="size-3.5 animate-spin" />} Salvar</Button></div>
          <p className="text-xs text-muted-foreground sm:col-span-4">O sistema confere conflitos com outros agendamentos e bloqueios antes de salvar. Encaixes fora da jornada são permitidos para a administração.</p>
        </form>
      )}
    </div>
  );
}

type Pay = { id: string; provider: string; status: string; statusLabel: string; method: string | null; amount: string; fee: string | null; date: string; orderId: string | null; paymentId: string | null; environment: string | null; notes: string | null; review: string | null };

export function PaymentPanel({ booking, payments }: { booking: { id: string; priceCents: number; paymentStatus: string; status: string; method: string }; payments: Pay[] }) {
  const { pending, run } = useRun();
  const [registering, setRegistering] = useState(false);
  const today = new Date();
  const canRegister = booking.paymentStatus !== "paid" && !["expired"].includes(booking.status);
  return (
    <div>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pagamento registrado. {booking.method === "in_person" ? "A cliente vai pagar no dia." : ""}</p>
      ) : (
        <ul className="space-y-3">
          {payments.map((p) => (
            <li key={p.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{p.provider === "manual" ? "Presencial" : "Mercado Pago"} · {p.amount}{p.method && <span className="text-muted-foreground"> · {p.method}</span>}</p>
                <StatusBadge status={p.status} label={p.statusLabel} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.date}
                {p.orderId && <> · Pedido {p.orderId}</>}
                {p.paymentId && <> · Transação {p.paymentId}</>}
                {p.environment && <> · {p.environment === "test" ? "ambiente de teste" : "produção"}</>}
                {p.fee && <> · Taxa {p.fee}</>}
              </p>
              {p.notes && <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>}
              {p.review && (
                <form
                  className="mt-3 space-y-2 rounded-lg bg-red-50 p-3 text-sm text-red-900"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const note = String(new FormData(e.currentTarget).get("note"));
                    run(() => resolveReviewAction(p.id, note), "Divergência marcada como resolvida.");
                  }}
                >
                  <p><strong>Revisão necessária:</strong> {p.review}</p>
                  <Input name="note" placeholder="Como foi resolvido? (ex.: reembolsado, remarcado para 12/05)" required />
                  <Button size="sm" variant="outline" disabled={pending}>Marcar como resolvido</Button>
                </form>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {p.provider === "mercadopago" && p.orderId && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => syncPaymentAction(p.id), "Status consultado no Mercado Pago.")}>
                    <RefreshCw className="size-3.5" /> Consultar status
                  </Button>
                )}
                {p.status === "approved" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-merlot"
                    disabled={pending}
                    onClick={() => {
                      const notes = prompt(p.provider === "manual" ? "Registrar estorno do valor recebido presencialmente. Observação:" : "Solicitar reembolso TOTAL ao Mercado Pago. Observação:");
                      if (notes === null) return;
                      run(() => refundAction(p.id, notes), p.provider === "manual" ? "Estorno registrado." : "Reembolso solicitado.");
                    }}
                  >
                    {p.provider === "manual" ? "Registrar estorno" : "Reembolsar"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canRegister && !registering && (
        <Button className="mt-4" variant="teal" onClick={() => setRegistering(true)}>Registrar pagamento presencial</Button>
      )}
      {registering && (
        <form
          className="mt-4 grid gap-3 rounded-xl bg-teal-mist/50 p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(
              () => registerPaymentAction(booking.id, { amount: String(fd.get("amount")), method: String(fd.get("method")), paidDate: String(fd.get("date")), paidTime: String(fd.get("time")), notes: String(fd.get("notes") ?? "") }),
              "Pagamento registrado.",
              () => setRegistering(false),
            );
          }}
        >
          <label className="text-sm">Valor recebido (R$)<Input name="amount" defaultValue={(booking.priceCents / 100).toFixed(2).replace(".", ",")} inputMode="decimal" required className="mt-1" /></label>
          <label className="text-sm">Forma
            <select name="method" className={`${selectClass} mt-1`} defaultValue="pix">
              <option value="pix">Pix</option>
              <option value="cash">Dinheiro</option>
              <option value="credit_card">Cartão de crédito</option>
              <option value="debit_card">Cartão de débito</option>
              <option value="bank_transfer">Transferência</option>
              <option value="other">Outro</option>
            </select>
          </label>
          <label className="text-sm">Data<Input name="date" type="date" defaultValue={`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`} required className="mt-1" /></label>
          <label className="text-sm">Hora<Input name="time" type="time" defaultValue={`${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`} required className="mt-1" /></label>
          <label className="text-sm sm:col-span-2">Observações<Input name="notes" maxLength={500} className="mt-1" /></label>
          <div className="flex gap-2 sm:col-span-2">
            <Button variant="teal" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Salvar recebimento</Button>
            <Button type="button" variant="ghost" onClick={() => setRegistering(false)}>Cancelar</Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function NotesForm({ id, notes }: { id: string; notes: string }) {
  const { pending, run } = useRun();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = String(new FormData(e.currentTarget).get("notes"));
        run(() => saveAdminNotesAction(id, v), "Notas salvas.");
      }}
      className="space-y-2"
    >
      <Textarea name="notes" defaultValue={notes} rows={4} maxLength={2000} placeholder="Visível apenas para a equipe." />
      <Button size="sm" variant="outline" disabled={pending}>Salvar notas</Button>
    </form>
  );
}
