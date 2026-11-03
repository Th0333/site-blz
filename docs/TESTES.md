# Testes

`npm test` roda 32 testes automatizados (Vitest) em um PostgreSQL real em memória (PGlite), com as mesmas migrações e constraints de produção.

| Arquivo | Cobre |
| --- | --- |
| `tests/engine.test.ts` | Fuso America/Sao_Paulo; jornada, pausa, preparação, bloqueios e antecedência no motor de horários |
| `tests/bookings.test.ts` | Calendário, concorrência, constraint do banco, "qualquer profissional", pagamento no dia, preço congelado, expiração, isolamento entre clientes, políticas |
| `tests/payments.test.ts` | Regras financeiras (aprovado, recusado, reembolso, divergência, aprovado após expiração), resumo financeiro, assinatura do webhook |
| `tests/auth.test.ts` | Cadastro público não define papel nem usuário; login por nome de usuário |
| `tests/mercadopago.test.ts` | Checkout Pro com a API do Mercado Pago simulada: corpo do pedido, idempotência, webhook assinado e duplicado, assinatura inválida, retorno do checkout |

## Os 18 testes obrigatórios

| # | Requisito | Como foi validado | Situação |
| --- | --- | --- | --- |
| 1 | Cadastro e login | Teste manual no navegador: cadastro em `/cadastro` vindo do agendamento e retorno ao fluxo; login de administradora em `/entrar` | ✅ validado |
| 2 | Selecionar serviço | Navegador (etapa 1) | ✅ validado |
| 3 | Selecionar profissional disponível | Navegador: só aparecem profissionais habilitadas; teste "qualquer profissional" | ✅ validado |
| 4 | Calendário respeita horários e bloqueios | `bookings.test.ts` e `engine.test.ts`; no navegador, dias de folga e datas passadas desabilitados | ✅ validado |
| 5 | Dois clientes não reservam o mesmo horário | `bookings.test.ts`: 5 reservas simultâneas resultam em 1 sucesso, e a constraint `EXCLUDE` barra a sobreposição direto no banco | ✅ validado |
| 6 | Pagamento no dia fica pendente | Teste automatizado e navegador (painel mostrou R$ 220 pendente e R$ 0 recebido) | ✅ validado |
| 7 | Admin registra pagamento presencial | Teste automatizado (inclui bloqueio de duplicidade) e navegador (lançamento com autoria no histórico) | ✅ validado |
| 8 | Pagamento real em ambiente de testes do Mercado Pago | Integração implementada e testada com a API simulada. **O teste no sandbox real depende das credenciais da proprietária**: roteiro abaixo | ⏳ pendente de credenciais |
| 9 | Webhook atualiza o status financeiro | `mercadopago.test.ts` (assinatura válida, consulta à API, idempotência). No sandbox real: roteiro abaixo | ✅ simulado / ⏳ sandbox |
| 10 | Recusado não aumenta receita | `payments.test.ts` e `mercadopago.test.ts` | ✅ validado |
| 11 | Aprovado não é contado duas vezes | Notificações repetidas e concorrentes resultam em 1 lançamento (índice único por pagamento e tipo) | ✅ validado |
| 12 | Cadastro de profissionais com fotos | Navegador: upload real convertido para WebP, salvo no banco e servido em `/api/media/:id` | ✅ validado |
| 13 | Cadastro de serviços e edição de valores | Navegador: preço alterado de R$ 220 para R$ 240 aparece no site, e o agendamento antigo manteve R$ 220 (também coberto em teste automatizado) | ✅ validado |
| 14 | Dashboard com dados corretos | `payments.test.ts` (resumo financeiro) e navegador (pendente, recebido e contagens antes e depois do registro) | ✅ validado |
| 15 | Clientes não acessam dados de outros | `bookings.test.ts` (consulta, cancelamento e reagendamento de terceiros negados) e `mercadopago.test.ts` (checkout de terceiros negado). As consultas da área da cliente filtram sempre pelo usuário da sessão | ✅ validado |
| 16 | Usuário comum sem funções administrativas | Navegador: cliente em `/admin` é redirecionada, e a exportação CSV retorna 403. Toda ação de admin chama `requireAdmin()` no servidor | ✅ validado |
| 17 | Layout no celular | Navegador a 375 px: sem rolagem horizontal; hero, agendamento e horários verificados | ✅ validado |
| 18 | Dados e fotos persistem após reiniciar | Servidor reiniciado: agendamento, pagamento e fotos continuaram disponíveis (fotos ficam no banco) | ✅ validado |

## 8 e 9: Mercado Pago (sandbox)

Pré-requisitos: o site publicado em HTTPS (webhooks não alcançam `localhost`) e acesso à conta Mercado Pago da proprietária.

1. Em *Suas integrações*, crie a aplicação Checkout Pro e abra **Contas de teste**. Crie um **vendedor** e um **comprador** de teste.
2. Entre no painel do site como administradora → **Integração Mercado Pago**:
   - ambiente **Teste**;
   - Public Key e Access Token de teste (do vendedor de teste);
   - em Webhooks (modo de teste), cadastre a URL exibida, com o evento **Order (Mercado Pago)**, e cole a **assinatura secreta**;
   - **Testar integração**: o resultado esperado é "Integração configurada · Ambiente de teste".
   - Ative **pagamento online**.
3. Em uma janela anônima, crie uma conta de cliente, escolha um serviço e, no pagamento, **Pagar agora com Mercado Pago**.
4. No checkout, entre com o **comprador de teste** e pague com um cartão de teste da documentação oficial. Para simular aprovação ou recusa, use os nomes de titular indicados pelo Mercado Pago (ex.: `APRO` aprova, `OTHE` recusa).
5. Verifique:
   - [ ] Voltar ao site mostra o status real (consultado na API), sem depender da URL.
   - [ ] Em **Agendamentos**, o atendimento ficou *Confirmado* e o pagamento *Pago*.
   - [ ] Em **Financeiro**, aparece 1 transação com o ID do pedido e o recebido aumentou uma única vez.
   - [ ] No assistente, o checklist marca "Webhook configurado", "Teste de pagamento realizado" e "Confirmação validada".
   - [ ] Repita com recusa (`OTHE`): a reserva continua aguardando pagamento, a cliente pode tentar de novo e a receita não muda.
   - [ ] Em **Reembolsar** na ficha, o status vira *Reembolsado* e aparece um lançamento negativo no financeiro.
6. Com tudo validado, troque para as credenciais de **produção** e o ambiente **Produção**.

## Roteiro manual rápido (regressão)

- [ ] Visitante navega pela home e serviços sem login; ao concluir o agendamento, é pedido login e as escolhas permanecem.
- [ ] Horário recém-reservado some da lista para outra cliente.
- [ ] Cliente cancela e reagenda dentro da política; fora da política, vê a orientação para falar com o estúdio.
- [ ] Profissional desativada some do agendamento, mas seus agendamentos futuros continuam na agenda com aviso.
- [ ] Bloqueio de horário remove a disponibilidade imediatamente.
- [ ] Exportar CSV abre corretamente no Excel/Planilhas.
