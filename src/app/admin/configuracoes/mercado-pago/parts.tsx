"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { selectClass } from "@/components/admin/ui";
import { clearCredentialsAction, saveCredentialsAction, setPaymentMethodsAction, testConnectionAction } from "./actions";

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <Input readOnly value={value} aria-label="URL de notificações" className="font-mono text-sm" onFocus={(e) => e.target.select()} />
      <Button
        type="button"
        variant="teal"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("URL copiada.");
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copiar URL
      </Button>
    </div>
  );
}

export function CredentialsForm({ environment, publicKey, tokenSaved, secretSaved }: { environment: "test" | "production"; publicKey: string; tokenSaved: string | null; secretSaved: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-5 grid gap-4 rounded-2xl bg-paper p-4 sm:grid-cols-2 sm:p-5"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          const r = await saveCredentialsAction({
            environment: fd.get("environment") === "production" ? "production" : "test",
            publicKey: String(fd.get("publicKey") ?? ""),
            accessToken: String(fd.get("accessToken") ?? ""),
            webhookSecret: String(fd.get("webhookSecret") ?? ""),
          });
          if (!r.ok) return void toast.error(r.error);
          // limpa os campos secretos do formulário após o envio
          (form.elements.namedItem("accessToken") as HTMLInputElement).value = "";
          (form.elements.namedItem("webhookSecret") as HTMLInputElement).value = "";
          toast.success("Credenciais salvas com segurança. Agora teste a integração.");
          router.refresh();
        });
      }}
    >
      <Field id="environment" label="Ambiente">
        <select id="environment" name="environment" defaultValue={environment} className={selectClass}>
          <option value="test">Teste (sandbox)</option>
          <option value="production">Produção (cobranças reais)</option>
        </select>
      </Field>
      <Field id="publicKey" label="Public Key"><Input id="publicKey" name="publicKey" defaultValue={publicKey} placeholder="APP_USR-… ou TEST-…" /></Field>
      <Field id="accessToken" label="Access Token" hint={tokenSaved ? `Salvo: ${tokenSaved}. Deixe em branco para manter.` : "Cole o Access Token da aplicação."}>
        <Input id="accessToken" name="accessToken" type="password" autoComplete="new-password" spellCheck={false} placeholder={tokenSaved ? "••••••••••••" : "APP_USR-…"} />
      </Field>
      <Field id="webhookSecret" label="Assinatura secreta do webhook" hint={secretSaved ? "Salva. Deixe em branco para manter." : "Obtida no passo 4."}>
        <Input id="webhookSecret" name="webhookSecret" type="password" autoComplete="new-password" spellCheck={false} />
      </Field>
      <div className="sm:col-span-2">
        <Button variant="default" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Salvar credenciais</Button>
      </div>
    </form>
  );
}

export function TestButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ status: string; message: string; environment: string } | null>(null);
  return (
    <div className="mt-4">
      <Button
        variant="teal"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await testConnectionAction();
            if (!r.ok) return void toast.error(r.error);
            setResult(r.data);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />} Testar integração
      </Button>
      {result && (
        <p role="status" className={`mt-3 rounded-xl px-4 py-3 text-sm ${result.status === "ok" ? "bg-emerald-50 text-emerald-800" : result.status === "incomplete" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-800"}`}>
          <strong>{{ ok: "Integração configurada", incomplete: "Integração incompleta", invalid_credentials: "Credenciais inválidas", communication_error: "Erro de comunicação" }[result.status] ?? result.status}</strong>
          {" · "}Ambiente de {result.environment === "production" ? "produção" : "teste"}. {result.message}
        </p>
      )}
    </div>
  );
}

export function ActivationToggles({ online, inPerson, configured }: { online: boolean; inPerson: boolean; configured: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [on, setOn] = useState(online);
  const [day, setDay] = useState(inPerson);
  return (
    <div className="mt-5 rounded-2xl bg-paper p-4">
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="size-4 accent-[var(--brand-teal)]" /> Oferecer <strong>pagamento online</strong> no site</label>
      <label className="mt-2 flex items-center gap-3 text-sm"><input type="checkbox" checked={day} onChange={(e) => setDay(e.target.checked)} className="size-4 accent-[var(--brand-teal)]" /> Oferecer <strong>pagamento no dia</strong></label>
      {on && !configured && <p className="mt-2 text-xs text-amber-800">Enquanto as credenciais não estiverem salvas, a opção online fica oculta para as clientes.</p>}
      {!on && !day && <p className="mt-2 text-xs text-red-700">Com as duas opções desligadas, ninguém consegue concluir um agendamento pelo site.</p>}
      <Button
        className="mt-3"
        size="sm"
        disabled={pending}
        onClick={() => start(async () => { const r = await setPaymentMethodsAction(on, day); if (!r.ok) return void toast.error(r.error); toast.success("Formas de pagamento atualizadas."); router.refresh(); })}
      >
        {pending && <Loader2 className="size-3.5 animate-spin" />} Salvar formas de pagamento
      </Button>
    </div>
  );
}

export function ClearButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="mt-6 text-sm text-merlot underline underline-offset-4"
      disabled={pending}
      onClick={() => confirm("Remover as credenciais salvas e desativar o pagamento online?") && start(async () => { const r = await clearCredentialsAction(); if (!r.ok) return void toast.error(r.error); toast.success("Credenciais removidas."); router.refresh(); })}
    >
      Remover credenciais salvas
    </button>
  );
}
