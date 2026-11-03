# Implantação

Roteiro para colocar o site no ar com dados reais. Os exemplos usam Vercel + Supabase, mas qualquer hospedagem Node.js 20.9+ com PostgreSQL funciona.

## 1. Banco de dados (PostgreSQL)

1. Crie um projeto no Supabase (ou Neon, RDS etc.).
2. Copie a *connection string*. No Supabase: **Project Settings → Database → Connection string → URI**. Em hospedagem serverless, prefira a do *pooler* (porta 6543).
3. A extensão `btree_gist` é criada pela migração. Ela está disponível no Supabase e no Neon e garante, no próprio banco, que dois agendamentos nunca ocupem o mesmo horário da mesma profissional.

## 2. Variáveis de ambiente

Cadastre no gerenciador de segredos da hospedagem (Vercel: **Project → Settings → Environment Variables**). A lista completa está em [`.env.example`](../.env.example).

| Variável | Obrigatória | Observação |
| --- | --- | --- |
| `DATABASE_URL` | sim | PostgreSQL de produção |
| `APP_URL` e `BETTER_AUTH_URL` | sim | `https://seudominio.com.br` |
| `BETTER_AUTH_SECRET` | sim | 32+ bytes aleatórios |
| `APP_ENCRYPTION_KEY` | sim | 32+ caracteres; protege credenciais salvas pelo painel |
| `CRON_SECRET` | recomendada | Protege a rotina de manutenção |
| `SMTP_URL` e `EMAIL_FROM` | opcional | Envio real de e-mails |
| `MP_*` | opcional | Credenciais do Mercado Pago, alternativa ao painel |

Gerar segredos:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## 3. Build e migrações

Na Vercel, defina o **Build Command** como `npm run build:deploy`. Ele aplica as migrações e depois faz o build. Em outra hospedagem:

```bash
npm ci
npm run db:migrate
npm run build
npm start
```

## 4. Primeiro administrador (com segurança)

Não existe cadastro público de administradores. O papel `role` não pode ser enviado pelo formulário de cadastro: ele é forçado como `client` no servidor. Para criar o primeiro acesso, rode **uma vez**, de um computador com acesso ao banco de produção:

```bash
DATABASE_URL="postgres://..." npm run admin:create -- --email dona@estudio.com.br --name "Nome Completo" --username admin
```

- O script pede a senha no terminal, sem eco e sem gravar no histórico. Sem terminal interativo, gera uma senha forte e a exibe uma única vez.
- Se o e-mail já tiver conta de cliente, ela é **promovida** e a senha atual é mantida.
- Com `--username admin`, o login pode ser feito digitando apenas **admin** (ou o e-mail). Nomes de usuário só podem ser definidos por este script: o cadastro público ignora esse campo.
- Para trocar a senha de uma conta existente: acrescente `--nova-senha`. Pelo site, use *Minha conta → Alterar senha*.
- **Não use senhas fracas como "admin"**: o painel dá acesso a dados pessoais das clientes (LGPD).
- Para dar acesso de profissional: `--role professional`. Depois, vincule o e-mail no cadastro da profissional pelo painel.
- A operação fica registrada na auditoria.

## 5. Mercado Pago

Siga o assistente em **Painel → Integração Mercado Pago** (`/admin/configuracoes/mercado-pago`). Resumo:

1. Crie uma aplicação do tipo **Checkout Pro** em *Suas integrações*.
2. Salve a **Public Key**, o **Access Token** e a **assinatura secreta do webhook** pelo painel (o Access Token fica criptografado com `APP_ENCRYPTION_KEY`), ou pelas variáveis `MP_*`.
3. Em **Webhooks**, cadastre `https://seudominio.com.br/api/webhooks/mercadopago` com o evento **Order (Mercado Pago)**.
4. Clique em **Testar integração** e faça um pagamento de teste ([docs/TESTES.md](TESTES.md#8-e-9--mercado-pago-sandbox)).
5. Troque para as credenciais de **produção** e ative o pagamento online.

Webhooks exigem HTTPS público, então `localhost` não recebe notificações. Em desenvolvimento, a página de retorno e o botão **Consultar status** consultam a API diretamente.

## 6. Rotina de manutenção (cron)

As reservas temporárias expiram sozinhas a cada acesso ao sistema. Ainda assim, recomenda-se chamar a cada 15 minutos:

```
GET https://seudominio.com.br/api/cron/manutencao
Authorization: Bearer <CRON_SECRET>
```

A rotina libera reservas vencidas e reconsulta pedidos pendentes caso algum webhook tenha se perdido. Use o Vercel Cron (o plano Hobby só permite execução diária), o cron do Supabase (`pg_cron` + `pg_net`) ou um serviço como cron-job.org.

## 7. E-mail (opcional)

Defina `SMTP_URL` (qualquer provedor SMTP: Resend, Brevo, SES, Google Workspace) e `EMAIL_FROM`. Sem isso:

- nenhum e-mail é enviado, e o sistema registra o envio como `skipped` em vez de fingir que enviou;
- os avisos continuam aparecendo na área da cliente;
- a recuperação de senha mostra que o envio está indisponível e oferece o WhatsApp do estúdio.

Para exigir confirmação de e-mail no cadastro, use `REQUIRE_EMAIL_VERIFICATION=1`, com SMTP configurado.

## 8. Depois do deploy

- [ ] Entrar em `/admin` com a conta criada no passo 4.
- [ ] **Configurações do estúdio**: nome, logotipo, fotos, textos, endereço, WhatsApp, Instagram, horários e políticas.
- [ ] Remover o conteúdo de demonstração, caso tenha sido carregado.
- [ ] Cadastrar profissionais (foto, serviços, jornada, intervalos, folgas) e serviços (preço, duração, preparo).
- [ ] Configurar o Mercado Pago e concluir o checklist do passo 6 do assistente.
- [ ] Revisar os textos de privacidade e termos (LGPD) com um profissional jurídico.
