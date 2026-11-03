"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Ban, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { selectClass } from "@/components/admin/ui";
import { createManualBookingAction } from "../agendamentos/actions";
import { TimeOffManager } from "../profissionais/forms";

export function AgendaToolbar({
  pros,
  services,
  clients,
  defaultDate,
  defaultPro,
  openNew,
}: {
  pros: { id: string; name: string }[];
  services: { id: string; name: string; durationMin: number }[];
  clients: { id: string; name: string; email: string }[];
  defaultDate: string;
  defaultPro: string;
  openNew: boolean;
}) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(openNew);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockPro, setBlockPro] = useState(defaultPro || pros[0]?.id || "");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [pending, start] = useTransition();
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)).slice(0, 50);
  }, [clients, search]);

  return (
    <>
      <Button variant="outline" onClick={() => setBlockOpen(true)}><Ban className="size-4" /> Bloquear horário</Button>
      <Button onClick={() => setNewOpen(true)}><Plus className="size-4" /> Novo agendamento</Button>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-petrol">Novo agendamento</DialogTitle>
            <DialogDescription>Para atendimentos combinados no balcão ou WhatsApp. O pagamento fica como “no dia” e pode ser registrado depois.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                const r = await createManualBookingAction({
                  clientId: mode === "existing" ? String(fd.get("clientId") || "") || undefined : undefined,
                  newClient: mode === "new" ? { name: String(fd.get("name")), email: String(fd.get("email")), phone: String(fd.get("phone")) } : undefined,
                  serviceId: String(fd.get("serviceId")),
                  professionalId: String(fd.get("professionalId")),
                  date: String(fd.get("date")),
                  time: String(fd.get("time")),
                  notes: String(fd.get("notes") ?? "") || undefined,
                });
                if (!r.ok) return void toast.error(r.error);
                toast.success("Agendamento criado.");
                setNewOpen(false);
                router.push(`/admin/agendamentos/${r.data.id}`);
              });
            }}
          >
            <div className="inline-flex rounded-full bg-muted p-1 text-sm">
              <button type="button" onClick={() => setMode("existing")} className={`rounded-full px-3 py-1 ${mode === "existing" ? "bg-card shadow" : ""}`}>Cliente cadastrada</button>
              <button type="button" onClick={() => setMode("new")} className={`rounded-full px-3 py-1 ${mode === "new" ? "bg-card shadow" : ""}`}>Nova cliente</button>
            </div>
            {mode === "existing" ? (
              <div className="space-y-2">
                <Input placeholder="Buscar por nome ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar cliente" />
                <select name="clientId" required className={selectClass} size={Math.min(6, Math.max(2, filtered.length))} aria-label="Cliente">
                  {filtered.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.email}</option>)}
                </select>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2">Nome completo<Input name="name" required className="mt-1" /></label>
                <label className="text-sm">E-mail<Input name="email" type="email" required className="mt-1" /></label>
                <label className="text-sm">Celular<Input name="phone" type="tel" required className="mt-1" /></label>
                <p className="text-xs text-muted-foreground sm:col-span-2">A cliente poderá acessar a conta definindo uma senha em “Esqueci minha senha”.</p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Serviço
                <select name="serviceId" required className={`${selectClass} mt-1`}>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.durationMin} min)</option>)}
                </select>
              </label>
              <label className="text-sm">Profissional
                <select name="professionalId" required defaultValue={defaultPro || undefined} className={`${selectClass} mt-1`}>
                  {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="text-sm">Data<Input name="date" type="date" defaultValue={defaultDate} required className="mt-1" /></label>
              <label className="text-sm">Horário<Input name="time" type="time" required className="mt-1" /></label>
              <label className="text-sm sm:col-span-2">Observações<Input name="notes" className="mt-1" /></label>
            </div>
            <Button className="w-full" size="lg" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Criar agendamento</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-petrol">Bloquear horário</DialogTitle>
            <DialogDescription>Folga, férias, compromisso ou estúdio fechado. Horários bloqueados somem do agendamento online.</DialogDescription>
          </DialogHeader>
          <label className="text-sm">Profissional
            <select value={blockPro} onChange={(e) => setBlockPro(e.target.value)} className={`${selectClass} mt-1`}>
              {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <TimeOffManager key={blockPro} professionalId={blockPro || null} items={[]} />
        </DialogContent>
      </Dialog>
    </>
  );
}
