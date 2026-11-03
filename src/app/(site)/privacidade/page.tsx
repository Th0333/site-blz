import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { LegalPage } from "@/components/site/legal";

export const metadata: Metadata = { title: "Política de privacidade" };

export default async function PrivacyPage() {
  const s = await getSettings();
  const fallback = `Esta política explica como o ${s.studioName} trata seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

Quais dados coletamos
Nome, e-mail, telefone, histórico de agendamentos e registros de pagamento. Não armazenamos números de cartão nem códigos de segurança: pagamentos online são processados no ambiente seguro do Mercado Pago.

Para que usamos
Para criar e gerenciar sua conta, agendar e confirmar atendimentos, registrar pagamentos, enviar avisos sobre seus horários e cumprir obrigações legais e fiscais.

Com quem compartilhamos
Com o Mercado Pago, apenas quando você escolhe pagar online, e com provedores de hospedagem e envio de e-mail necessários ao funcionamento do site. Não vendemos seus dados.

Por quanto tempo
Enquanto sua conta estiver ativa e pelo prazo exigido por lei para registros fiscais e contábeis.

Seus direitos
Você pode acessar, corrigir e baixar seus dados e excluir sua conta a qualquer momento pela área Minha conta. Também pode falar com a gente pelos contatos do site${s.email ? ` ou pelo e-mail ${s.email}` : ""}.

Cookies
Usamos apenas cookies essenciais para manter você conectada com segurança.`;
  return <LegalPage title="Política de privacidade" text={s.privacyPolicy || fallback} isDefault={!s.privacyPolicy} />;
}
