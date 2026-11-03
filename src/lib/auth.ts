import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { appUrl } from "@/lib/env";
import { emailConfigured, emailLayout, sendEmail } from "@/server/email";

export const REQUIRE_EMAIL_VERIFICATION =
  process.env.REQUIRE_EMAIL_VERIFICATION === "1" && emailConfigured();

async function createAuth() {
  const db = await getDb();
  return betterAuth({
    appName: "Estúdio",
    baseURL: appUrl(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        rateLimit: schema.rateLimit,
      },
    }),
    user: {
      additionalFields: {
        // input:false => impossível definir pelo cadastro público (sem admin público)
        role: { type: "string", required: false, defaultValue: "client", input: false },
        phone: { type: "string", required: false, input: true },
        acceptedTermsAt: { type: "date", required: false, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: REQUIRE_EMAIL_VERIFICATION,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const body = `Recebemos um pedido para redefinir sua senha.\nO link é válido por 1 hora. Se não foi você, ignore este e-mail.`;
        await sendEmail(user.email, "Redefinição de senha", `${body}\n\n${url}`, emailLayout("Redefinição de senha", body, { label: "Criar nova senha", url }));
      },
    },
    emailVerification: {
      sendOnSignUp: REQUIRE_EMAIL_VERIFICATION,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const body = `Falta só confirmar seu e-mail para concluir o cadastro.`;
        await sendEmail(user.email, "Confirme seu e-mail", `${body}\n\n${url}`, emailLayout("Confirme seu e-mail", body, { label: "Confirmar e-mail", url }));
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: process.env.NODE_ENV === "production" || process.env.AUTH_RATE_LIMIT === "1",
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 300, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
        "/forget-password": { window: 300, max: 3 },
      },
    },
    advanced: {
      useSecureCookies: appUrl().startsWith("https://"),
      database: { generateId: () => crypto.randomUUID() },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (u) => ({ data: { ...u, role: "client", acceptedTermsAt: new Date() } }),
          after: async (u) => {
            const { emitEvent } = await import("@/server/events");
            await emitEvent({
              type: "client.registered",
              userId: u.id,
              title: "Boas-vindas!",
              body: "Sua conta foi criada. Agora você pode agendar e acompanhar seus atendimentos por aqui.",
            });
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

type Auth = Awaited<ReturnType<typeof createAuth>>;
const g = globalThis as unknown as { __estudioAuth?: Promise<Auth> };

export function getAuth(): Promise<Auth> {
  g.__estudioAuth ??= createAuth().catch((e) => {
    g.__estudioAuth = undefined;
    throw e;
  });
  return g.__estudioAuth;
}
