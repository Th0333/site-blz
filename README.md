# Plataforma de agendamentos — Estúdio de beleza

Site público, agendamento online com disponibilidade real, área da cliente, painel administrativo completo e pagamentos pelo **Mercado Pago (Checkout Pro via Orders API)** ou no dia do atendimento.

O nome padrão "Atelier Carmim" é provisório: nome, logotipo, textos, fotos, contatos, regras e políticas são editados em **Painel → Configurações do estúdio**, sem mexer no código.

## Stack

| Camada | Escolha |
| --- | --- |
| App | Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19, TypeScript |
| Interface | Tailwind CSS 4, shadcn/ui (Base UI), `motion`, componentes de Magic UI e Cult UI, efeitos adaptados de Aceternity, Animata, Kokonut, Skiper e outros (ver [docs/DESIGN.md](docs/DESIGN.md)) |
| Banco | PostgreSQL (Supabase, Neon...) com Drizzle ORM e migrações. Em desenvolvimento, PostgreSQL embarcado (PGlite) |
| Autenticação | Better Auth (e-mail e senha, recuperação, confirmação de e-mail opcional, limite de tentativas) |
| Pagamentos | API oficial do Mercado Pago: `POST /v1/orders`, webhooks assinados e consulta `GET /v1/orders/{id}` |
| Fotos | Otimizadas no upload (WebP, `sharp`) e guardadas no banco: persistem entre deploys |
| Testes | Vitest (30 testes), mais o roteiro manual em [docs/TESTES.md](docs/TESTES.md) |

Interface em português do Brasil, valores em BRL e fuso `America/Sao_Paulo`.

## Rodar localmente

```bash
npm install
cp .env.example .env.local        # preencha BETTER_AUTH_SECRET e APP_ENCRYPTION_KEY
npm run seed:demo                 # opcional: conteúdo de DEMONSTRAÇÃO (marcado e removível)
npm run admin:create -- --email voce@estudio.com.br --name "Seu Nome"
npm run dev
```

Sem `DATABASE_URL`, o banco local é um PostgreSQL embarcado em `./.data/pglite`, e as migrações rodam automaticamente. Com o PGlite, pare o `npm run dev` antes de rodar scripts como `seed:demo` e `admin:create`.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm test` | Testes automatizados (banco PostgreSQL em memória) |
| `npm run typecheck` / `npm run lint` | Verificações estáticas |
| `npm run db:migrate` | Aplica migrações no PostgreSQL de `DATABASE_URL` |
| `npm run db:generate` | Gera migração após alterar `src/db/schema.ts` |
| `npm run admin:create` | Cria ou promove a administradora (ou `--role professional`) |
| `npm run seed:demo` | Carrega conteúdo de demonstração |

## Documentação

- [docs/IMPLANTACAO.md](docs/IMPLANTACAO.md): publicação, banco, variáveis, primeiro administrador, Mercado Pago, e-mail e cron
- [docs/GUIA-DE-USO.md](docs/GUIA-DE-USO.md): guia da proprietária (painel, agenda, financeiro, pagamentos)
- [docs/TESTES.md](docs/TESTES.md): os 18 testes obrigatórios, o que é automatizado e o roteiro do sandbox Mercado Pago
- [docs/DESIGN.md](docs/DESIGN.md): identidade visual, tokens e bibliotecas de UI usadas
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): modelo de dados, regras de negócio e segurança
