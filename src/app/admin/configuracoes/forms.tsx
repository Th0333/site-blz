"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { StudioSettings } from "@/lib/settings-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { Card } from "@/components/admin/ui";
import { ImageInput } from "@/components/admin/image-input";
import { loadDemoAction, removeDemoAction, saveSettingsAction } from "./actions";

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Card title={<span id={id} className="scroll-mt-24">{title}</span>}>
      {description && <p className="-mt-2 mb-4 text-sm text-muted-foreground">{description}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("_section", id);
          start(async () => {
            const r = await saveSettingsAction(fd);
            if (!r.ok) return void toast.error(r.error);
            toast.success("Configurações salvas.");
            router.refresh();
          });
        }}
      >
        {children}
        <div className="mt-5 flex justify-end">
          <Button disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Salvar</Button>
        </div>
      </form>
    </Card>
  );
}

function Check({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm has-[:checked]:border-teal has-[:checked]:bg-teal-mist/40">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-[var(--brand-teal)]" />
      <span><span className="font-medium">{label}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
    </label>
  );
}

function PairList({ names, labels, initial, placeholders }: { names: [string, string]; labels: [string, string]; initial: [string, string][]; placeholders: [string, string] }) {
  const [rows, setRows] = useState(initial.length ? initial : [["", ""] as [string, string]]);
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
          <Input name={names[0]} defaultValue={r[0]} placeholder={placeholders[0]} aria-label={labels[0]} />
          <Input name={names[1]} defaultValue={r[1]} placeholder={placeholders[1]} aria-label={labels[1]} />
          <button type="button" aria-label="Remover linha" onClick={() => setRows((x) => x.filter((_, k) => k !== i))} className="grid size-11 place-items-center rounded-xl text-merlot hover:bg-blush-veil"><Trash2 className="size-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => setRows((x) => [...x, ["", ""]])} className="flex items-center gap-1 text-sm text-teal"><Plus className="size-4" /> Adicionar</button>
    </div>
  );
}

export function SettingsForms({ s, images, demo, mpConfigured, emailOn }: { s: StudioSettings; images: Record<"logoId" | "heroImageId" | "heroSecondaryImageId" | "aboutImageId", string | null>; demo: boolean; mpConfigured: boolean; emailOn: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      <nav aria-label="Seções" className="flex flex-wrap gap-2 text-sm">
        {[["identidade", "Identidade"], ["inicio", "Página inicial"], ["contato", "Contato"], ["agenda", "Regras de agenda"], ["pagamentos", "Pagamentos"], ["legal", "Privacidade e termos"], ["demonstracao", "Demonstração"]].map(([id, l]) => (
          <a key={id} href={`#${id}`} className="rounded-full bg-card px-3 py-1.5 ring-1 ring-border hover:text-petrol">{l}</a>
        ))}
      </nav>

      <Section id="identidade" title="Identidade">
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="grid gap-4">
            <Field id="studioName" label="Nome do estúdio"><Input id="studioName" name="studioName" defaultValue={s.studioName} required maxLength={80} /></Field>
            <Field id="tagline" label="Frase de apoio" hint="Aparece no rodapé e nos resultados de busca."><Input id="tagline" name="tagline" defaultValue={s.tagline} maxLength={120} /></Field>
          </div>
          <ImageInput name="logoId" current={images.logoId} label="Logotipo (opcional)" aspect="aspect-[3/2]" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Sem logotipo, o site usa um logotipo tipográfico com o nome do estúdio.</p>
      </Section>

      <Section id="inicio" title="Página inicial">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field id="heroEyebrow" label="Chamada acima do título"><Input id="heroEyebrow" name="heroEyebrow" defaultValue={s.heroEyebrow} maxLength={80} /></Field>
          <Field id="heroTitle" label="Título principal" hint="As duas últimas palavras recebem o traço de destaque."><Input id="heroTitle" name="heroTitle" defaultValue={s.heroTitle} maxLength={140} /></Field>
          <Field id="heroSubtitle" label="Subtítulo" className="lg:col-span-2"><Textarea id="heroSubtitle" name="heroSubtitle" defaultValue={s.heroSubtitle} maxLength={300} rows={2} /></Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <ImageInput name="heroImageId" current={images.heroImageId} label="Foto principal" />
          <ImageInput name="heroSecondaryImageId" current={images.heroSecondaryImageId} label="Foto de detalhe" aspect="aspect-square" />
          <ImageInput name="aboutImageId" current={images.aboutImageId} label="Foto da seção Sobre" />
        </div>
        <div className="mt-6 grid gap-4">
          <Field id="aboutTitle" label="Título da seção Sobre"><Input id="aboutTitle" name="aboutTitle" defaultValue={s.aboutTitle} maxLength={140} /></Field>
          <Field id="aboutText" label="Texto da seção Sobre" hint="Deixe uma linha em branco entre parágrafos."><Textarea id="aboutText" name="aboutText" defaultValue={s.aboutText} rows={6} /></Field>
          <div>
            <p className="mb-2 text-[0.85rem] font-medium">Destaques do estúdio</p>
            <PairList names={["highlightTitle", "highlightText"]} labels={["Título", "Texto"]} placeholders={["Pele em primeiro lugar", "Preparação completa antes de cada maquiagem"]} initial={s.highlights.map((h) => [h.title, h.text])} />
          </div>
        </div>
      </Section>

      <Section id="contato" title="Contato e localização">
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="address" label="Endereço" className="md:col-span-2"><Textarea id="address" name="address" defaultValue={s.address} rows={2} /></Field>
          <Field id="mapsUrl" label="Link do mapa (Google Maps)"><Input id="mapsUrl" name="mapsUrl" defaultValue={s.mapsUrl} type="url" /></Field>
          <Field id="whatsapp" label="WhatsApp (com DDI e DDD)" hint="Ex.: 5511987654321"><Input id="whatsapp" name="whatsapp" defaultValue={s.whatsapp} inputMode="tel" /></Field>
          <Field id="instagram" label="Instagram (usuário)"><Input id="instagram" name="instagram" defaultValue={s.instagram} placeholder="seuestudio" /></Field>
          <Field id="email" label="E-mail de contato"><Input id="email" name="email" type="email" defaultValue={s.email} /></Field>
          <Field id="phone" label="Telefone"><Input id="phone" name="phone" defaultValue={s.phone} /></Field>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-[0.85rem] font-medium">Horário geral de funcionamento</p>
          <PairList names={["hoursLabel", "hoursValue"]} labels={["Dias", "Horário"]} placeholders={["Terça a sexta", "9h às 19h"]} initial={s.openingHours.map((h) => [h.label, h.hours])} />
          <p className="mt-2 text-xs text-muted-foreground">É informativo. A disponibilidade real vem da jornada de cada profissional.</p>
        </div>
      </Section>

      <Section id="agenda" title="Regras de agendamento e política de cancelamento">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="slotIntervalMin" label="Intervalo entre horários (min)"><Input id="slotIntervalMin" name="slotIntervalMin" type="number" min={5} max={120} defaultValue={s.slotIntervalMin} /></Field>
          <Field id="minNoticeHours" label="Antecedência mínima (horas)"><Input id="minNoticeHours" name="minNoticeHours" type="number" min={0} defaultValue={s.minNoticeHours} /></Field>
          <Field id="maxDaysAhead" label="Agendar até (dias à frente)"><Input id="maxDaysAhead" name="maxDaysAhead" type="number" min={1} max={365} defaultValue={s.maxDaysAhead} /></Field>
          <Field id="holdMinutes" label="Reserva aguardando pagamento online (min)" hint="Depois disso o horário é liberado."><Input id="holdMinutes" name="holdMinutes" type="number" min={5} defaultValue={s.holdMinutes} /></Field>
          <Field id="cancelMinHours" label="Cancelamento online até (horas antes)"><Input id="cancelMinHours" name="cancelMinHours" type="number" min={0} defaultValue={s.cancelMinHours} /></Field>
          <Field id="rescheduleMinHours" label="Reagendamento online até (horas antes)"><Input id="rescheduleMinHours" name="rescheduleMinHours" type="number" min={0} defaultValue={s.rescheduleMinHours} /></Field>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <Check name="allowAnyProfessional" label="Opção “Qualquer profissional disponível”" defaultChecked={s.allowAnyProfessional} />
          <Check name="allowClientCancel" label="Clientes podem cancelar pelo site" defaultChecked={s.allowClientCancel} />
          <Check name="allowClientReschedule" label="Clientes podem reagendar pelo site" defaultChecked={s.allowClientReschedule} />
        </div>
        <Field id="cancellationPolicy" label="Texto da política de cancelamento" className="mt-4"><Textarea id="cancellationPolicy" name="cancellationPolicy" defaultValue={s.cancellationPolicy} rows={3} placeholder="Ex.: Cancelamentos com menos de 24h de antecedência…" /></Field>
      </Section>

      <Section id="pagamentos" title="Formas de pagamento">
        <div className="grid gap-2 md:grid-cols-2">
          <Check name="inPersonPaymentEnabled" label="Pagar no dia do atendimento" defaultChecked={s.inPersonPaymentEnabled} />
          <Check name="onlinePaymentEnabled" label="Pagar online com Mercado Pago" defaultChecked={s.onlinePaymentEnabled} hint={mpConfigured ? "Integração configurada." : "Só aparece para as clientes depois de configurar a integração."} />
        </div>
        {!mpConfigured && <p className="mt-3 text-sm"><Link href="/admin/configuracoes/mercado-pago" className="text-teal underline">Configurar o Mercado Pago agora</Link></p>}
        <p className="mt-3 text-xs text-muted-foreground">E-mails automáticos: {emailOn ? "ativos (SMTP configurado)." : "desativados — configure SMTP_URL e EMAIL_FROM no servidor para enviar confirmações por e-mail. Os avisos continuam aparecendo na área da cliente."}</p>
      </Section>

      <Section id="legal" title="Privacidade e termos (LGPD)" description="Se ficar em branco, o site exibe um texto padrão. Recomendamos revisão por profissional jurídico.">
        <div className="grid gap-4">
          <Field id="privacyPolicy" label="Política de privacidade"><Textarea id="privacyPolicy" name="privacyPolicy" defaultValue={s.privacyPolicy} rows={8} /></Field>
          <Field id="termsOfUse" label="Termos de uso"><Textarea id="termsOfUse" name="termsOfUse" defaultValue={s.termsOfUse} rows={8} /></Field>
        </div>
      </Section>

      <Card title={<span id="demonstracao" className="scroll-mt-24">Conteúdo de demonstração</span>}>
        {demo ? (
          <>
            <p className="text-sm text-muted-foreground">O site exibe serviços, profissionais, fotos e textos de <strong>demonstração</strong> (com aviso visível para as visitantes). Remova-os quando cadastrar os dados reais. Profissionais de demonstração com agendamentos são apenas desativadas.</p>
            <Button className="mt-4" variant="destructive" disabled={pending} onClick={() => confirm("Remover todo o conteúdo de demonstração?") && start(async () => { const r = await removeDemoAction(); if (!r.ok) return void toast.error(r.error); toast.success("Demonstração removida."); router.refresh(); })}>
              {pending && <Loader2 className="size-4 animate-spin" />} Remover demonstração
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Nenhum conteúdo de demonstração ativo. Se quiser visualizar o site com exemplos (marcados como demonstração), carregue-os abaixo.</p>
            <Button className="mt-4" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await loadDemoAction(); if (!r.ok) return void toast.error(r.error); toast.success("Demonstração carregada."); router.refresh(); })}>
              {pending && <Loader2 className="size-4 animate-spin" />} Carregar demonstração
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
