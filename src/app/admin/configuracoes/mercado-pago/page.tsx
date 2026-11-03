import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getDb } from "@/db";
import { integrationErrors, paymentIntegration } from "@/db/schema";
import { getMpConfig } from "@/server/mercadopago";
import { getSettings } from "@/server/settings";
import { hasEncryptionKey } from "@/lib/crypto";
import { appUrl, isHttps } from "@/lib/env";
import { fmtDateTime } from "@/lib/time";
import { buttonVariants } from "@/components/ui/button";
import { SwatchWord } from "@/components/site/swatch";
import { CopyField, CredentialsForm, TestButton, ActivationToggles, ClearButton } from "./parts";

export const metadata = { title: "Configure seus pagamentos" };

const STATUS: Record<string, { label: string; tone: string }> = {
  ok: { label: "Integração configurada", tone: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  incomplete: { label: "Integração incompleta", tone: "bg-amber-50 text-amber-900 ring-amber-200" },
  invalid_credentials: { label: "Credenciais inválidas", tone: "bg-red-50 text-red-800 ring-red-200" },
  communication_error: { label: "Erro de comunicação", tone: "bg-red-50 text-red-800 ring-red-200" },
};

export default async function MercadoPagoSetup() {
  const db = await getDb();
  const [cfg, s] = await Promise.all([getMpConfig(), getSettings()]);
  const [row] = await db.select().from(paymentIntegration).where(eq(paymentIntegration.id, 1));
  const errors = await db.select().from(integrationErrors).orderBy(desc(integrationErrors.createdAt)).limit(8);
  const webhookUrl = `${appUrl()}/api/webhooks/mercadopago`;
  const https = isHttps();
  const status = !cfg.accessToken ? { label: "Integração não configurada", tone: "bg-zinc-100 text-zinc-700 ring-zinc-200" } : STATUS[row?.lastCheckStatus ?? ""] ?? { label: "Aguardando teste de conexão", tone: "bg-amber-50 text-amber-900 ring-amber-200" };
  const checkOk = row?.lastCheckStatus === "ok";

  const checklist = [
    { label: "Credenciais de produção configuradas", done: !!cfg.accessToken && cfg.environment === "production" && checkOk, hint: cfg.environment === "test" ? "Hoje o ambiente está como teste." : undefined },
    { label: "Domínio com HTTPS", done: https, hint: https ? undefined : `O endereço atual (${appUrl()}) não usa HTTPS. Publique o site em um domínio com HTTPS.` },
    { label: "Webhook configurado", done: !!cfg.webhookSecret && !!row?.lastWebhookAt, hint: !cfg.webhookSecret ? "Falta a assinatura secreta." : !row?.lastWebhookAt ? "Nenhuma notificação recebida ainda." : `Última notificação: ${fmtDateTime(row.lastWebhookAt)}` },
    { label: "Teste de pagamento realizado", done: !!row?.lastApprovedTestAt, hint: row?.lastApprovedTestAt ? `Aprovado em ${fmtDateTime(row.lastApprovedTestAt)}` : "Faça um agendamento com pagamento online usando contas de teste." },
    { label: "Confirmação de pagamento validada", done: !!(row?.lastApprovedTestAt || row?.lastApprovedLiveAt) && !!row?.lastWebhookAt, hint: "Um pagamento aprovado precisa chegar via webhook e ser confirmado na API." },
  ];

  return (
    <div className="mx-auto max-w-[980px]">
      <Link href="/admin/configuracoes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-petrol"><ArrowLeft className="size-4" /> Configurações</Link>
      <header className="rounded-[28px] bg-petrol p-6 text-white grain sm:p-10">
        <p className="eyebrow text-teal-haze">Integração Mercado Pago · Checkout Pro</p>
        <h1 className="display mt-4 text-[clamp(2.4rem,5vw,3.8rem)]">
          Configure seus <SwatchWord color="var(--brand-cherry)"><span className="italic">pagamentos</span></SwatchWord>
        </h1>
        <p className="mt-4 max-w-2xl text-[1.05rem] leading-relaxed text-[#cfe0df]">Conecte sua conta do Mercado Pago e comece a receber pagamentos online das suas clientes.</p>
        <div className="mt-8 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Status" value={<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${status.tone}`}>{status.label}</span>} />
          <Info label="Ambiente" value={cfg.accessToken ? (cfg.environment === "production" ? "Produção" : "Teste") : "—"} />
          <Info label="Última verificação" value={row?.lastCheckAt ? fmtDateTime(row.lastCheckAt) : "Nunca"} />
          <Info label="Pagamento online no site" value={s.onlinePaymentEnabled && cfg.accessToken ? "Ativo" : "Desativado"} />
        </div>
        {row?.lastCheckMessage && <p className="mt-4 text-sm text-[#cfe0df]">{row.lastCheckMessage}</p>}
      </header>

      <ol className="relative mt-10 space-y-6 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-px before:bg-border">
        <Step n={1} title="Acessar o Mercado Pago" done>
          <p>Entre no portal de desenvolvedores com a <strong>mesma conta Mercado Pago</strong> em que você quer receber o dinheiro.</p>
          <a href="https://www.mercadopago.com.br/developers/" target="_blank" rel="noopener noreferrer" className={`${buttonVariants({ variant: "teal" })} mt-4`}>Abrir Mercado Pago Developers <ExternalLink className="size-4" /></a>
        </Step>

        <Step n={2} title="Criar sua aplicação">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Entre com sua conta Mercado Pago.</li>
            <li>Abra a área <strong>Suas integrações</strong>.</li>
            <li>Clique em <strong>Criar aplicação</strong> e dê um nome, por exemplo “Site do estúdio”.</li>
            <li>Quando perguntar o tipo de solução, escolha <strong>Pagamentos online</strong> → <strong>Checkout Pro</strong>.</li>
            <li>Finalize as configurações solicitadas pelo Mercado Pago (dados do negócio e aceite dos termos).</li>
          </ol>
          <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal underline underline-offset-4">Abrir “Suas integrações” <ExternalLink className="size-3.5" /></a>
        </Step>

        <Step n={3} title="Obter e salvar as credenciais" done={!!cfg.accessToken && !!cfg.publicKey}>
          <p>Dentro da aplicação criada, abra <strong>Credenciais</strong>. Comece pelas <strong>credenciais de teste</strong>; depois de validar tudo, troque para as <strong>credenciais de produção</strong>.</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-paper p-4"><dt className="font-semibold text-petrol">Public Key</dt><dd className="mt-1 text-sm text-muted-foreground">Chave pública, usada quando a integração precisa identificar a conta no navegador. Não é secreta.</dd></div>
            <div className="rounded-xl bg-blush-veil/60 p-4"><dt className="font-semibold text-merlot">Access Token</dt><dd className="mt-1 text-sm text-muted-foreground">Credencial <strong>privada</strong>: permite cobrar em seu nome. Fica somente no servidor, criptografada, e nunca é exibida de novo por inteiro. Não envie por WhatsApp ou e-mail.</dd></div>
          </dl>
          {(cfg.source.accessToken === "env" || cfg.source.webhookSecret === "env") && (
            <p className="mt-4 rounded-xl bg-teal-mist px-4 py-3 text-sm text-teal-deep">Credenciais definidas pelo gerenciador de segredos da hospedagem (variáveis de ambiente) têm prioridade sobre as cadastradas aqui.</p>
          )}
          {!hasEncryptionKey() && cfg.source.accessToken !== "env" && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Para salvar credenciais pelo painel, a hospedagem precisa ter a variável APP_ENCRYPTION_KEY definida. Alternativa: cadastre MP_ACCESS_TOKEN, MP_PUBLIC_KEY e MP_WEBHOOK_SECRET direto no gerenciador de segredos.</p>
          )}
          <CredentialsForm environment={cfg.environment} publicKey={cfg.publicKey ?? ""} tokenSaved={row?.accessTokenLast4 ? `••••${row.accessTokenLast4}` : cfg.source.accessToken === "env" ? "definido no servidor" : null} secretSaved={!!cfg.webhookSecret} />
        </Step>

        <Step n={4} title="Configurar Webhooks (notificações)" done={!!cfg.webhookSecret && !!row?.lastWebhookAt}>
          <p>É por aqui que o Mercado Pago avisa o site quando um pagamento é aprovado, recusado ou estornado.</p>
          <CopyField value={webhookUrl} />
          {!https && <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Este endereço não é HTTPS público, então o Mercado Pago não consegue alcançá-lo. Use o endereço do site publicado (ex.: https://seudominio.com.br/api/webhooks/mercadopago).</p>}
          <ol className="mt-4 list-decimal space-y-1.5 pl-5">
            <li>Na sua aplicação, abra <strong>Webhooks</strong> → <strong>Configurar notificações</strong>.</li>
            <li>Cole a URL acima no campo do modo que estiver usando (<strong>modo de teste</strong> e/ou <strong>modo produtivo</strong>).</li>
            <li>Em eventos, marque <strong>Order (Mercado Pago)</strong>. Opcionalmente marque também <strong>Pagamentos</strong> e <strong>Contestações</strong>.</li>
            <li>Salve. O Mercado Pago gera uma <strong>assinatura secreta</strong>: copie e cole no campo “Assinatura secreta do webhook” do passo 3.</li>
          </ol>
          <p className="mt-3 text-sm text-muted-foreground">Toda notificação tem a assinatura conferida e o status é sempre confirmado consultando a API oficial; notificações repetidas não duplicam valores.</p>
        </Step>

        <Step n={5} title="Testar integração" done={checkOk}>
          <p>O teste consulta o Mercado Pago com o Access Token salvo — nada é marcado como pronto só porque os campos foram preenchidos.</p>
          <TestButton />
          <div className="mt-4 rounded-xl bg-paper p-4 text-sm">
            <p className="font-semibold text-petrol">Como fazer um pagamento de teste</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Salve as credenciais de <strong>teste</strong> e deixe o ambiente como “Teste”.</li>
              <li>Ative o pagamento online no passo 6.</li>
              <li>Em uma janela anônima, crie uma conta de cliente no site e agende escolhendo “Pagar agora”.</li>
              <li>No checkout, use um comprador/cartão de teste indicado na documentação do Mercado Pago.</li>
              <li>Volte ao site: o agendamento deve aparecer como pago aqui no painel.</li>
            </ol>
          </div>
        </Step>

        <Step n={6} title="Ativar recebimentos" done={checklist.every((c) => c.done)}>
          <ul className="space-y-2">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-start gap-3 text-sm">
                <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[0.65rem] font-bold ${c.done ? "bg-teal text-white" : "bg-muted text-muted-foreground"}`}>{c.done ? "✓" : ""}</span>
                <span><span className={c.done ? "text-graphite" : "text-graphite"}>{c.label}</span>{c.hint && <span className="block text-xs text-muted-foreground">{c.hint}</span>}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">A liberação definitiva também depende das verificações e aprovações da sua conta no Mercado Pago.</p>
          <ActivationToggles online={s.onlinePaymentEnabled} inPerson={s.inPersonPaymentEnabled} configured={!!cfg.accessToken} />
        </Step>
      </ol>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border/80 bg-card p-6">
          <h2 className="font-semibold text-graphite">Erros recentes da integração</h2>
          {errors.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhum erro registrado.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {errors.map((e) => (
                <li key={e.id} className="rounded-lg bg-paper p-2.5"><span className="text-xs text-muted-foreground">{fmtDateTime(e.createdAt)} · {e.context}</span><span className="block break-words">{e.message}</span></li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-border/80 bg-card p-6">
          <h2 className="font-semibold text-graphite">Ajuda e documentação oficial</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              ["Checkout Pro (Orders API) — visão geral", "https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/overview"],
              ["Notificações de pagamento (Webhooks)", "https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications"],
              ["Suas integrações (painel)", "https://www.mercadopago.com.br/developers/panel/app"],
              ["Central de ajuda Mercado Pago", "https://www.mercadopago.com.br/ajuda"],
            ].map(([l, u]) => (
              <li key={u}><a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-teal underline underline-offset-4">{l} <ExternalLink className="size-3.5" /></a></li>
            ))}
          </ul>
          {cfg.source.accessToken === "db" && <ClearButton />}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
      <p className="text-xs text-[#a9c6c4]">{label}</p>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <li className="relative pl-14">
      <span className={`absolute left-0 top-0 grid size-10 place-items-center rounded-full font-display text-lg ${done ? "bg-teal text-white" : "bg-card text-petrol ring-1 ring-border"}`}>{done ? "✓" : n}</span>
      <div className="rounded-2xl border border-border/80 bg-card p-5 text-[0.95rem] leading-relaxed sm:p-6">
        <h2 className="font-display text-2xl text-petrol"><span className="sr-only">Passo {n}: </span>{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </li>
  );
}
