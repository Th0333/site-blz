# Arquitetura e regras de negócio

## Estrutura

```
src/
  app/
    (site)/        site público, agendamento, minha conta, área da profissional, páginas legais
    (auth)/        entrar, cadastro, recuperar e redefinir senha
    admin/         painel (layout protegido por requireAdminPage)
    api/           auth, disponibilidade, mídia, webhook MP, cron, CSV, exportação LGPD
  db/              schema Drizzle + conexão (PostgreSQL ou PGlite)
  server/          regras de negócio (agendamentos, disponibilidade, pagamentos, Mercado Pago, finanças...)
  components/      UI (shadcn + componentes da marca)
  proxy.ts         barreira otimista para rotas protegidas
drizzle/           migrações SQL (inclui a constraint anti-sobreposição)
scripts/           migrar, criar admin, demonstração
tests/             Vitest
```

## Modelo de dados

| Tabela | Conteúdo |
| --- | --- |
| `user`, `session`, `account`, `verification`, `rate_limit` | Autenticação (Better Auth). `user.role` assume `client`, `professional` ou `admin` |
| `professionals`, `services`, `service_professionals` | Equipe, serviços e quem faz o quê |
| `working_hours` | Jornada por dia da semana, com intervalo |
| `time_off` | Folgas, férias, bloqueios; `professional_id` nulo significa estúdio fechado |
| `bookings` | Agendamentos com **snapshot** do serviço (nome, descrição, preço, duração, preparo) |
| `payments` | Tentativas e pagamentos (Mercado Pago ou manual), IDs do provedor, taxas, revisão |
| `financial_entries` | Livro-caixa: só dinheiro efetivamente recebido ou estornado |
| `webhook_events` | Notificações recebidas (deduplicação e auditoria) |
| `studio_settings`, `payment_integration` | Configurações; credenciais criptografadas |
| `media` | Fotos (WebP no banco) ou URL externa (somente demonstração) |
| `testimonials`, `gallery_items`, `faqs` | Conteúdo do site |
| `events` | Avisos às clientes e status do e-mail (`sent`, `skipped`, `failed`) |
| `audit_logs`, `integration_errors` | Auditoria e erros de integração sem segredos |

## Regras críticas

**Sem dupla reserva.** A disponibilidade é revalidada no servidor dentro de uma transação. Além disso, o PostgreSQL tem a constraint `EXCLUDE USING gist (professional_id WITH =, tstzrange(starts_at, block_ends_at) WITH &&)` para status ativos. Mesmo com duas requisições simultâneas, só uma grava. Com "qualquer profissional", o sistema tenta a próxima profissional livre.

**Preço calculado no servidor.** O navegador envia apenas IDs, data e horário. O preço vem do serviço cadastrado e é congelado no agendamento.

**Reservas temporárias.** O pagamento online cria o agendamento como `pending_payment`, com `hold_expires_at`. Reservas vencidas viram `expired` e deixam de bloquear a agenda, verificado em toda consulta e pela rotina de cron.

**Status independentes.** O atendimento fica em `bookings.status` e o financeiro em `bookings.payment_status`.

**Receita somente confirmada.** Painel e financeiro somam `financial_entries`, que só recebe lançamentos quando:
- o Mercado Pago confirma (consultando `GET /v1/orders/{id}`), ou
- a administradora registra um recebimento presencial.

O índice único `(payment_id, kind)` impede contar duas vezes. O índice parcial em `payments` impede dois pagamentos aprovados "regulares" no mesmo agendamento. Uma aprovação duplicada é registrada **em revisão**.

**Divergências.** Valor, moeda ou referência diferentes, pagamento duplicado e pagamento aprovado após expiração com horário ocupado geram `review_reason` e mostram um alerta no painel.

## Mercado Pago (Checkout Pro via Orders API)

1. `startCheckout` cria `POST /v1/orders` com `type: online`, `processing_mode: manual`, `total_amount` do agendamento, `external_reference` igual ao ID do agendamento, `X-Idempotency-Key`, `expiration_time` igual ao tempo restante da reserva e `config.online.*_url`. A cliente é redirecionada para `checkout_url`.
2. Uma nova tentativa reaproveita o checkout aberto ou cria um novo pedido para **a mesma reserva**. Nunca duplica o agendamento.
3. O webhook (`/api/webhooks/mercadopago`) segue esta ordem:
   1. valida `x-signature` com HMAC-SHA256 sobre `id:{data.id};request-id:{x-request-id};ts:{ts};`;
   2. deduplica pelo `x-request-id`;
   3. consulta o pedido na API;
   4. aplica o status de forma idempotente.
4. A página de retorno também consulta a API. Os parâmetros da URL nunca aprovam nada.
5. Nenhum dado de cartão passa pelo site.

## Segurança

- Verificação de sessão e papel no servidor em toda página e ação: `requireUser`, `requireAdmin`. O `proxy.ts` é só uma barreira otimista.
- O cadastro público nunca define `role`: o campo tem `input: false` e um hook força `client`.
- Validação com zod em todas as entradas. Redirecionamentos `next` aceitam apenas caminhos internos.
- Limite de tentativas de login, cadastro e recuperação (Better Auth, armazenado no banco; ativo em produção).
- Segredos do Mercado Pago criptografados com AES-256-GCM (`APP_ENCRYPTION_KEY`). O Access Token nunca volta ao navegador, aos logs ou às respostas.
- Cabeçalhos de segurança: `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Exportação CSV protegida contra injeção de fórmulas.
- LGPD: aceite de termos no cadastro, exportação dos próprios dados, exclusão da conta (com anonimização dos registros fiscais) e política de privacidade editável.
