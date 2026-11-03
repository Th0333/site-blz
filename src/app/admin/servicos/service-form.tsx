"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { Card } from "@/components/admin/ui";
import { ImageInput } from "@/components/admin/image-input";
import { deleteServiceAction, saveServiceAction } from "./actions";

type Svc = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  priceFrom: boolean;
  durationMin: number;
  bufferMin: number;
  sortOrder: number;
  active: boolean;
  featured: boolean;
  photo: string | null;
  professionalIds: string[];
};

export function ServiceForm({ svc, pros, categories }: { svc: Svc | null; pros: { id: string; name: string; active: boolean }[]; categories: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (fd.get("remove_photo") === "1") fd.set("removePhoto", "1");
        start(async () => {
          const r = await saveServiceAction(svc?.id ?? null, fd);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Serviço salvo.");
          router.push("/admin/servicos");
          router.refresh();
        });
      }}
      className="grid gap-6 lg:grid-cols-3"
    >
      <div className="space-y-6 lg:col-span-2">
        <Card title="Informações">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label="Nome do serviço" className="sm:col-span-2"><Input id="name" name="name" defaultValue={svc?.name} required maxLength={80} /></Field>
            <Field id="category" label="Categoria" hint="Agrupa os serviços no site (ex.: Maquiagem, Noivas).">
              <Input id="category" name="category" defaultValue={svc?.category ?? "Maquiagem"} list="cat-list" required maxLength={40} />
              <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field id="sortOrder" label="Ordem de exibição" hint="Menor número aparece primeiro."><Input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={svc?.sortOrder ?? 0} /></Field>
            <Field id="description" label="Descrição" className="sm:col-span-2"><Textarea id="description" name="description" rows={4} maxLength={600} defaultValue={svc?.description} /></Field>
          </div>
        </Card>
        <Card title="Preço e tempo">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="price" label="Preço (R$)" hint="Valor cobrado no agendamento."><Input id="price" name="price" inputMode="decimal" defaultValue={svc?.price} placeholder="180,00" required /></Field>
            <Field id="durationMin" label="Duração (min)"><Input id="durationMin" name="durationMin" type="number" min={5} step={5} defaultValue={svc?.durationMin ?? 60} required /></Field>
            <Field id="bufferMin" label="Preparação extra (min)" hint="Bloqueia a agenda após o atendimento."><Input id="bufferMin" name="bufferMin" type="number" min={0} step={5} defaultValue={svc?.bufferMin ?? 0} /></Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" name="priceFrom" defaultChecked={svc?.priceFrom} className="size-4 accent-[var(--brand-merlot)]" /> Exibir como “a partir de” no site</label>
        </Card>
        <Card title="Profissionais habilitadas">
          {pros.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cadastre profissionais primeiro para vinculá-las a este serviço.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {pros.map((p) => (
                <label key={p.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm has-[:checked]:border-teal has-[:checked]:bg-teal-mist/50">
                  <input type="checkbox" name="professionals" value={p.id} defaultChecked={svc?.professionalIds.includes(p.id)} className="size-4 accent-[var(--brand-teal)]" />
                  {p.name}
                  {!p.active && <span className="text-xs text-muted-foreground">(inativa)</span>}
                </label>
              ))}
            </div>
          )}
        </Card>
      </div>
      <div className="space-y-6">
        <Card title="Foto ilustrativa">
          <ImageInput name="photo" current={svc?.photo ?? null} label="Foto" />
        </Card>
        <Card title="Visibilidade">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={svc?.active ?? true} className="size-4 accent-[var(--brand-teal)]" /> Ativo (aparece no site e no agendamento)</label>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={svc?.featured} className="size-4 accent-[var(--brand-teal)]" /> Destaque na página inicial</label>
        </Card>
        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Salvar serviço</Button>
          {svc && (
            <Button
              type="button"
              variant="ghost"
              className="text-merlot"
              disabled={pending}
              onClick={() => {
                if (!confirm("Excluir este serviço? Agendamentos antigos continuam com os dados registrados.")) return;
                start(async () => {
                  const r = await deleteServiceAction(svc.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Serviço excluído.");
                  router.push("/admin/servicos");
                  router.refresh();
                });
              }}
            >
              Excluir serviço
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
