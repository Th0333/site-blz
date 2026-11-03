# Guia de uso: painel administrativo

Acesse `/admin` com a conta de administradora. No celular, o menu fica no ícone ☰.

## Primeiros passos

1. **Configurações do estúdio**: preencha nome, logotipo (opcional), fotos da página inicial, textos, endereço, WhatsApp (com DDI e DDD, ex.: `5511987654321`), Instagram e horário de funcionamento.
2. **Serviços**: cadastre cada serviço com foto, preço, duração, *preparação extra* (tempo bloqueado depois do atendimento), categoria, ordem e profissionais habilitadas. Serviços sem profissional habilitada não aparecem para agendamento.
3. **Profissionais**: cadastre foto, nome exibido, especialidades, biografia e serviços. Depois de salvar, defina a **jornada semanal** com intervalo e as **folgas, férias e bloqueios**.
4. **Integração Mercado Pago**: siga o assistente para receber online. Até lá, o site oferece apenas "pagar no dia".
5. Se o site estiver com **conteúdo de demonstração**, um aviso aparece para as visitantes. Remova em *Configurações → Demonstração*.

## Agenda

- Visões de **dia, semana e mês**, com filtro por profissional. Faixas cinza indicam horários fora da jornada; listras vinho indicam bloqueios.
- **Novo agendamento**: para atendimentos combinados no balcão ou pelo WhatsApp. Escolha uma cliente cadastrada ou cadastre uma nova; ela pode criar a senha depois em "Esqueci minha senha". Encaixes fora da jornada são permitidos, mas sobreposições nunca.
- **Bloquear horário**: folga, férias, compromisso ou estúdio fechado (feriado). O horário some do agendamento online imediatamente. Se já houver atendimentos no período, o sistema avisa e não cancela nada sozinho.

## Agendamentos

Cada agendamento tem **dois status independentes**:

| Atendimento | Pagamento |
| --- | --- |
| Reservado (aguardando pagamento online), Agendado, Confirmado, Concluído, Cancelado, Não compareceu, Reserva expirada | Pendente, Pago, Reembolsado, Não cobrado, Em análise |

Na ficha do agendamento você pode:

- **confirmar**, **registrar chegada**, **marcar concluído**, **não compareceu** ou desfazer o status;
- **reagendar**: escolha nova data, horário e profissional. O sistema confere conflitos antes de salvar;
- **cancelar** informando o motivo. A cliente é avisada. Pagamentos aprovados **não** são estornados automaticamente;
- **registrar pagamento presencial**: valor, forma (Pix, dinheiro, cartão...), data, hora e observação. Fica registrado quem lançou, e o sistema impede lançar duas vezes;
- **reembolsar**: pagamento online é reembolsado no Mercado Pago; pagamento presencial gera um estorno no caixa;
- **converter para pagar no dia** uma reserva online que ainda não foi paga;
- adicionar **notas internas** e consultar o **histórico** completo.

## Reservas com pagamento online

Ao escolher "Pagar agora", o horário fica reservado pelo tempo definido em *Configurações → Regras de agendamento* (padrão: 30 min). Se o pagamento não for concluído nesse prazo, o horário volta a ficar livre.

Se um pagamento for aprovado **depois** que a reserva expirou:

- com o horário ainda livre, o agendamento é confirmado;
- com o horário já ocupado, o pagamento entra em **"Em análise"** e aparece um alerta no painel e no Financeiro, para você remarcar ou reembolsar.

## Financeiro

- **Total bruto recebido** soma só dinheiro confirmado (pagamentos online aprovados e recebimentos presenciais lançados).
- **Pendente** e **Previsto** vêm dos agendamentos e **não** são receita.
- **Líquido estimado** = recebido − reembolsos − taxas informadas pelo provedor. **Não** é o saldo disponível no Mercado Pago, que depende de prazos de liberação e tarifas.
- Filtros por período, status, canal e busca. Use **Exportar CSV** para abrir no Excel ou Google Planilhas (separador `;`).
- **Revisão**: pagamentos com divergência de valor, duplicados ou aprovados após expiração. Resolva e registre como foi resolvido.

## Clientes

Lista com busca, total de agendamentos e total pago. A ficha mostra o histórico completo. Clientes podem baixar ou excluir os próprios dados pela área *Minha conta* (LGPD).

## Galeria e conteúdo

- **Galeria**: envie até 12 fotos por vez. As fotos são otimizadas automaticamente. Ajuste legenda, ordem e visibilidade.
- **Depoimentos**: as clientes enviam pela área *Minha conta* após atendimentos concluídos, e **nada é publicado sem aprovação**. Você também pode cadastrar depoimentos recebidos por outros canais, desde que sejam reais e autorizados.
- **Perguntas frequentes**: crie, edite, ordene e oculte.

## Perfil "profissional"

A profissional cria a própria conta no site. No cadastro dela no painel, informe o e-mail em **Conta de acesso**. A partir daí ela vê somente a própria agenda em `/profissional`.

## Notificações

O sistema registra avisos para: cadastro, novo agendamento, cancelamento, reagendamento, pagamento aprovado, recusado, estornado e em análise. Os avisos aparecem na área da cliente. Com SMTP configurado, também são enviados por e-mail. Para conversar com a cliente, use o botão de WhatsApp na ficha: ele abre o WhatsApp com uma mensagem pronta, sem automação.
