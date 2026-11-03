"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  addGalleryAction,
  createTestimonialAction,
  deleteFaqAction,
  deleteGalleryAction,
  deleteTestimonialAction,
  saveFaqAction,
  setTestimonialApprovedAction,
  updateGalleryAction,
} from "./actions";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error((r as { error: string }).error);
      if (msg) toast.success(msg);
      after?.();
      router.refresh();
    });
  return { pending, run };
}

export function GalleryManager({ items }: { items: { id: string; src: string; caption: string; active: boolean; sortOrder: number; demo: boolean }[] }) {
  const { pending, run } = useRun();
  return (
    <div>
      <form
        className="flex flex-col gap-3 rounded-xl bg-paper p-4 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          run(() => addGalleryAction(new FormData(form)), "Fotos adicionadas.", () => form.reset());
        }}
      >
        <label className="flex-1 text-sm">Fotos (até 12 por vez)<Input name="files" type="file" accept="image/*" multiple required className="mt-1 pt-2.5" /></label>
        <label className="flex-1 text-sm">Legenda (opcional)<Input name="caption" maxLength={140} className="mt-1" /></label>
        <Button variant="teal" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Enviar</Button>
      </form>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nenhuma foto na galeria. A seção fica oculta no site até haver fotos.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((i) => (
            <li key={i.id} className={cn("overflow-hidden rounded-xl border border-border bg-card", !i.active && "opacity-50")}>
              <img src={i.src} alt={i.caption} className="aspect-[3/4] w-full object-cover" loading="lazy" />
              <div className="space-y-2 p-2">
                <Input defaultValue={i.caption} placeholder="Legenda" aria-label="Legenda" className="h-9 text-xs" onBlur={(e) => e.target.value !== i.caption && run(() => updateGalleryAction(i.id, { caption: e.target.value }), "Legenda salva.")} />
                <div className="flex items-center justify-between">
                  <Input type="number" defaultValue={i.sortOrder} aria-label="Ordem" className="h-8 w-20 text-xs" onBlur={(e) => Number(e.target.value) !== i.sortOrder && run(() => updateGalleryAction(i.id, { sortOrder: Number(e.target.value) }))} />
                  <span className="flex">
                    <button aria-label={i.active ? "Ocultar" : "Exibir"} disabled={pending} onClick={() => run(() => updateGalleryAction(i.id, { active: !i.active }))} className="grid size-8 place-items-center rounded-full hover:bg-muted">{i.active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</button>
                    <button aria-label="Excluir" disabled={pending} onClick={() => confirm("Excluir esta foto?") && run(() => deleteGalleryAction(i.id), "Foto removida.")} className="grid size-8 place-items-center rounded-full text-merlot hover:bg-blush-veil"><Trash2 className="size-4" /></button>
                  </span>
                </div>
                {i.demo && <span className="text-[0.65rem] text-amber-700">demonstração</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TestimonialsManager({ items }: { items: { id: string; author: string; text: string; rating: number | null; service: string | null; approved: boolean; fromClient: boolean; date: string; demo: boolean }[] }) {
  const { pending, run } = useRun();
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">Clientes enviam depoimentos pela área “Minha conta” após atendimentos concluídos. Nada é publicado sem a sua aprovação.</p>
      <ul className="space-y-3">
        {items.length === 0 && <li className="text-sm text-muted-foreground">Nenhum depoimento ainda.</li>}
        {items.map((t) => (
          <li key={t.id} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {t.author}
                  {t.service && <span className="font-normal text-muted-foreground"> · {t.service}</span>}
                  {t.rating && <span className="ml-2 inline-flex items-center gap-0.5 text-cherry">{Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="size-3 fill-current" />)}</span>}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-graphite">“{t.text}”</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.date} · {t.fromClient ? "enviado pela cliente" : "cadastrado pela equipe"}{t.demo && " · demonstração"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("rounded-full px-2.5 py-1 text-xs", t.approved ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>{t.approved ? "Publicado" : "Aguardando aprovação"}</span>
                <Button size="sm" variant={t.approved ? "outline" : "teal"} disabled={pending} onClick={() => run(() => setTestimonialApprovedAction(t.id, !t.approved), t.approved ? "Depoimento ocultado." : "Depoimento publicado.")}>{t.approved ? "Ocultar" : "Aprovar"}</Button>
                <button aria-label="Excluir" disabled={pending} onClick={() => confirm("Excluir este depoimento?") && run(() => deleteTestimonialAction(t.id), "Excluído.")} className="grid size-8 place-items-center rounded-full text-merlot hover:bg-blush-veil"><Trash2 className="size-4" /></button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {adding ? (
        <form
          className="mt-4 grid gap-3 rounded-xl bg-paper p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => createTestimonialAction({ authorName: String(fd.get("author")), text: String(fd.get("text")), serviceLabel: String(fd.get("service") ?? ""), rating: 5 }), "Depoimento publicado.", () => setAdding(false));
          }}
        >
          <label className="text-sm">Nome da cliente<Input name="author" required className="mt-1" /></label>
          <label className="text-sm">Serviço (opcional)<Input name="service" className="mt-1" /></label>
          <label className="text-sm sm:col-span-2">Depoimento<Textarea name="text" required minLength={10} maxLength={800} className="mt-1" /></label>
          <p className="text-xs text-muted-foreground sm:col-span-2">Publique apenas depoimentos reais, com autorização da cliente.</p>
          <div className="flex gap-2"><Button variant="teal" disabled={pending}>Publicar</Button><Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button></div>
        </form>
      ) : (
        <Button className="mt-4" variant="outline" onClick={() => setAdding(true)}>Cadastrar depoimento recebido</Button>
      )}
    </div>
  );
}

export function FaqManager({ items }: { items: { id: string; question: string; answer: string; sortOrder: number; active: boolean; demo: boolean }[] }) {
  const { pending, run } = useRun();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const form = (f?: (typeof items)[number]) => (
    <form
      className="grid gap-3 rounded-xl bg-paper p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() => saveFaqAction(f?.id ?? null, { question: String(fd.get("q")), answer: String(fd.get("a")), sortOrder: Number(fd.get("o") || 0), active: fd.get("active") === "on" }), "Pergunta salva.", () => setEditing(null));
      }}
    >
      <label className="text-sm">Pergunta<Input name="q" defaultValue={f?.question} required className="mt-1" /></label>
      <label className="text-sm">Resposta<Textarea name="a" defaultValue={f?.answer} required rows={3} className="mt-1" /></label>
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sm">Ordem<Input name="o" type="number" defaultValue={f?.sortOrder ?? items.length} className="mt-1 w-24" /></label>
        <label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={f?.active ?? true} className="size-4 accent-[var(--brand-teal)]" /> Exibir no site</label>
      </div>
      <div className="flex gap-2"><Button variant="teal" disabled={pending}>Salvar</Button><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button></div>
    </form>
  );
  return (
    <div>
      <ul className="divide-y divide-border">
        {items.length === 0 && <li className="py-3 text-sm text-muted-foreground">Nenhuma pergunta cadastrada.</li>}
        {items.map((f) => (
          <li key={f.id} className="py-3">
            {editing === f.id ? (
              form(f)
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className={cn(!f.active && "opacity-50")}>
                  <p className="font-medium">{f.question}{f.demo && <span className="ml-2 text-xs text-amber-700">demonstração</span>}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{f.answer}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(f.id)}>Editar</Button>
                  <button aria-label="Excluir" disabled={pending} onClick={() => confirm("Excluir esta pergunta?") && run(() => deleteFaqAction(f.id), "Excluída.")} className="grid size-8 place-items-center rounded-full text-merlot hover:bg-blush-veil"><Trash2 className="size-4" /></button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing === "new" ? <div className="mt-3">{form()}</div> : <Button className="mt-3" variant="outline" onClick={() => setEditing("new")}>Adicionar pergunta</Button>}
    </div>
  );
}
