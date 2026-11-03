import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { LegalPage } from "@/components/site/legal";

export const metadata: Metadata = { title: "Termos de uso" };

export default async function TermsPage() {
  const s = await getSettings();
  const fallback = `Ao usar o site do ${s.studioName}, você concorda com estes termos.

Conta
Você é responsável pelas informações cadastradas e pela segurança da sua senha. Cada conta é pessoal.

Agendamentos
Os horários exibidos refletem a disponibilidade real da equipe no momento da consulta e são conferidos novamente antes da confirmação. Um agendamento só é considerado confirmado após a mensagem de confirmação no site.

Pagamentos
Você pode pagar no dia do atendimento (quando disponível) ou online pelo Mercado Pago. Reservas com pagamento online ficam guardadas por tempo limitado; se o pagamento não for concluído nesse prazo, o horário é liberado. Pagamento aprovado é diferente de agendamento confirmado: os dois status aparecem separadamente na sua conta.

Cancelamentos e remarcações
${s.cancellationPolicy || `Pelo site, cancelamentos são aceitos até ${s.cancelMinHours}h e remarcações até ${s.rescheduleMinHours}h antes do horário. Fora desse prazo, fale com o estúdio.`}

Contato
Dúvidas sobre estes termos podem ser enviadas pelos canais de contato do site.`;
  return <LegalPage title="Termos de uso" text={s.termsOfUse || fallback} isDefault={!s.termsOfUse} />;
}
