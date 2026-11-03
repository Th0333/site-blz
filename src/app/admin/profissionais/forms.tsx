"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { Card, selectClass } from "@/components/admin/ui";
import { ImageInput } from "@/components/admin/image-input";
import { fmtDateTime } from "@/lib/time";
import { addTimeOffAction, deleteTimeOffAction, saveHoursAction, saveProfessionalAction } from "./actions";

type Pro = {
  id: string;
  fullName: string;
  displayName: string;
  specialties: string;
  bio: string;
  sortOrder: number;
  active: boolean;
  photo: string | null;
  serviceIds: string[];
  accountEmail: string;
  futureBookings: number;
};

export function ProfessionalForm({ pro, services }: { pro: Pro | null; services: { id: string; name: string; active: boolean }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (pro?.active && fd.get("active") !== "on" && pro.futureBookings > 0) {
          if (!confirm(`Ela tem ${pro.futureBookings} agendamento(s) futuro(s). Eles NÃO serão cancelados automaticamente. Desativar mesmo assim?`)) return;
        }
        start(async () => {
          const r = await saveProfessionalAction(pro?.id ?? null, fd);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Profissional salva.");
          if (!pro) router.push(`/admin/profissionais/${r.data.id}`);
          router.refresh();
        });
      }}
      className="grid gap-6 lg:grid-cols-3"
    >
      <div className="space-y-6 lg:col-span-2">
        <Card title="Dados">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="fullName" label="Nome completo"><Input id="fullName" name="fullName" defaultValue={pro?.fullName} required /></Field>
            <Field id="displayName" label="Nome exibido no site"><Input id="displayName" name="displayName" defaultValue={pro?.displayName} required maxLength={40} /></Field>
            <Field id="specialties" label="Especialidades" hint="Separe por vírgula. Ex.: Noivas, Pele madura" className="sm:col-span-2"><Input id="specialties" name="specialties" defaultValue={pro?.specialties} /></Field>
            <Field id="bio" label="Biografia" className="sm:col-span-2"><Textarea id="bio" name="bio" rows={4} maxLength={1200} defaultValue={pro?.bio} /></Field>
            <Field id="sortOrder" label="Ordem de exibição"><Input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={pro?.sortOrder ?? 0} /></Field>
            <Field id="accountEmail" label="Conta de acesso" optional hint="E-mail de uma conta já criada no site. Ela passa a ver a própria agenda em /profissional.">
              <Input id="accountEmail" name="accountEmail" type="email" defaultValue={pro?.accountEmail} />
            </Field>
          </div>
        </Card>
        <Card title="Serviços que realiza">
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado ainda.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm has-[:checked]:border-teal has-[:checked]:bg-teal-mist/50">
                  <input type="checkbox" name="services" value={s.id} defaultChecked={pro?.serviceIds.includes(s.id)} className="size-4 accent-[var(--brand-teal)]" />
                  {s.name}
                  {!s.active && <span className="text-xs text-muted-foreground">(inativo)</span>}
                </label>
              ))}
            </div>
          )}
        </Card>
      </div>
      <div className="space-y-6">
        <Card title="Fotografia">
          <ImageInput name="photo" current={pro?.photo ?? null} label="Retrato" />
        </Card>
        <Card title="Status">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={pro?.active ?? true} className="size-4 accent-[var(--brand-teal)]" /> Ativa (disponível para novos agendamentos)</label>
          <p className="mt-2 text-xs text-muted-foreground">Desativar não cancela agendamentos já existentes.</p>
        </Card>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Salvar profissional</Button>
      </div>
    </form>
  );
}

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
type Day = { weekday: number; enabled: boolean; start: string; end: string; breakStart: string; breakEnd: string };

export function HoursEditor({ professionalId, initial }: { professionalId: string; initial: Day[] }) {
  const router = useRouter();
  const [days, setDays] = useState(initial);
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<Day>) => setDays((d) => d.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  return (
    <div>
      <div className="space-y-2">
        {days.map((d, i) => (
          <div key={d.weekday} className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 rounded-xl border border-border p-3 sm:grid-cols-[120px_1fr]">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={d.enabled} onChange={(e) => set(i, { enabled: e.target.checked })} className="size-4 accent-[var(--brand-teal)]" />
              {DAYS[d.weekday]}
            </label>
            {d.enabled ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input type="time" aria-label={`${DAYS[d.weekday]} início`} value={d.start} onChange={(e) => set(i, { start: e.target.value })} className="h-9 rounded-lg border border-input bg-card px-2" />
                <span>às</span>
                <input type="time" aria-label={`${DAYS[d.weekday]} fim`} value={d.end} onChange={(e) => set(i, { end: e.target.value })} className="h-9 rounded-lg border border-input bg-card px-2" />
                <span className="ml-1 text-muted-foreground">intervalo</span>
                <input type="time" aria-label={`${DAYS[d.weekday]} início do intervalo`} value={d.breakStart} onChange={(e) => set(i, { breakStart: e.target.value })} className="h-9 rounded-lg border border-input bg-card px-2" />
                <span>–</span>
                <input type="time" aria-label={`${DAYS[d.weekday]} fim do intervalo`} value={d.breakEnd} onChange={(e) => set(i, { breakEnd: e.target.value })} className="h-9 rounded-lg border border-input bg-card px-2" />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Folga semanal</span>
            )}
          </div>
        ))}
      </div>
      <Button
        className="mt-4"
        variant="teal"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await saveHoursAction(professionalId, days.map((d) => ({ ...d, breakStart: d.breakStart || undefined, breakEnd: d.breakEnd || undefined })));
            if (!r.ok) return void toast.error(r.error);
            toast.success("Jornada salva.");
            router.refresh();
          })
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" />} Salvar jornada
      </Button>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = { folga: "Folga", ferias: "Férias", bloqueio: "Bloqueio de horário", feriado: "Feriado / estúdio fechado" };

export function TimeOffManager({ professionalId, items }: { professionalId: string | null; items: { id: string; kind: string; startsAt: string; endsAt: string; reason: string | null; studioWide: boolean }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [allDay, setAllDay] = useState(true);
  return (
    <div>
      <form
        className="grid gap-3 rounded-xl bg-paper p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const form = e.currentTarget;
          start(async () => {
            const r = await addTimeOffAction({
              professionalId: fd.get("scope") === "studio" ? null : professionalId,
              kind: String(fd.get("kind")) as "folga",
              startDate: String(fd.get("startDate")),
              endDate: String(fd.get("endDate") || fd.get("startDate")),
              startTime: allDay ? undefined : String(fd.get("startTime")),
              endTime: allDay ? undefined : String(fd.get("endTime")),
              reason: String(fd.get("reason") ?? ""),
            });
            if (!r.ok) return void toast.error(r.error);
            toast.success(r.data.conflicts ? `Bloqueio salvo. Atenção: ${r.data.conflicts} agendamento(s) já existem nesse período e não foram cancelados.` : "Bloqueio salvo.");
            form.reset();
            router.refresh();
          });
        }}
      >
        <label className="text-sm">Tipo
          <select name="kind" className={selectClass} defaultValue="folga">
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="text-sm">Aplicar a
          <select name="scope" className={selectClass} defaultValue={professionalId ? "pro" : "studio"} disabled={!professionalId}>
            {professionalId && <option value="pro">Somente esta profissional</option>}
            <option value="studio">Estúdio inteiro</option>
          </select>
        </label>
        <label className="text-sm">De<Input name="startDate" type="date" required /></label>
        <label className="text-sm">Até<Input name="endDate" type="date" /></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 accent-[var(--brand-teal)]" /> Dia inteiro</label>
        {!allDay && (
          <>
            <label className="text-sm">Hora inicial<Input name="startTime" type="time" required /></label>
            <label className="text-sm">Hora final<Input name="endTime" type="time" required /></label>
          </>
        )}
        <label className="text-sm sm:col-span-2">Motivo (interno)<Input name="reason" maxLength={200} /></label>
        <Button type="submit" variant="teal" disabled={pending} className="sm:col-span-2">{pending && <Loader2 className="size-4 animate-spin" />} Adicionar bloqueio</Button>
      </form>
      <ul className="mt-4 divide-y divide-border">
        {items.length === 0 && <li className="py-3 text-sm text-muted-foreground">Nenhuma folga ou bloqueio futuro.</li>}
        {items.map((o) => (
          <li key={o.id} className="flex items-start justify-between gap-3 py-3 text-sm">
            <span>
              <span className="font-medium">{KIND_LABEL[o.kind] ?? o.kind}</span>
              {o.studioWide && <span className="ml-2 rounded-full bg-blush-veil px-2 py-0.5 text-xs text-merlot">Estúdio</span>}
              <span className="block text-muted-foreground">{fmtDateTime(new Date(o.startsAt))} → {fmtDateTime(new Date(o.endsAt))}{o.reason && ` · ${o.reason}`}</span>
            </span>
            <button
              aria-label="Remover bloqueio"
              disabled={pending}
              onClick={() => start(async () => { const r = await deleteTimeOffAction(o.id); if (!r.ok) toast.error(r.error); router.refresh(); })}
              className="grid size-9 place-items-center rounded-full text-merlot hover:bg-blush-veil"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
