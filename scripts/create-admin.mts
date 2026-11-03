/**
 * Cria (ou promove) a conta de ADMINISTRADORA. Não existe cadastro público de administradores.
 *
 *   npm run admin:create -- --email dona@estudio.com.br --name "Nome Completo" [--username admin] [--nova-senha]
 *
 * - Se o e-mail já tiver conta de cliente, ela é promovida a administradora (a senha não muda).
 * - Se não existir, a conta é criada. A senha é pedida no terminal (não fica no histórico);
 *   sem terminal interativo, uma senha forte é gerada e exibida uma única vez.
 * - --username define um login alternativo ao e-mail (ex.: "admin"). Só este script define usuários.
 * - --nova-senha troca a senha de uma conta existente.
 * - Use --role professional para criar o acesso de uma profissional.
 * Com PGlite local, pare o servidor de desenvolvimento antes de rodar.
 */
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { getDb, closeDb } from "../src/db";
import { account, auditLogs, user } from "../src/db/schema";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function askHidden(q: string): Promise<string> {
  if (!process.stdin.isTTY) return "";
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
  let muted = false;
  out._writeToOutput = (s: string) => (muted ? out.output.write("*") : out.output.write(s));
  return new Promise((resolve) => {
    rl.question(q, (v) => {
      rl.close();
      process.stdout.write("\n");
      resolve(v);
    });
    muted = true;
  });
}

const email = arg("email")?.trim().toLowerCase();
const name = arg("name")?.trim();
const role = arg("role") === "professional" ? "professional" : "admin";
const username = arg("username")?.trim().toLowerCase();
const resetPassword = process.argv.includes("--nova-senha");
if (username && !/^[a-z0-9._-]{3,40}$/.test(username)) {
  console.error("Usuário inválido: use 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado.");
  process.exit(1);
}

async function choosePassword() {
  let password = await askHidden("Defina a senha (mín. 10 caracteres): ");
  let generated = false;
  if (!password) {
    password = randomBytes(15).toString("base64url");
    generated = true;
  }
  if (password.length < 10) {
    console.error("Senha muito curta.");
    process.exit(1);
  }
  return { password, generated };
}
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Informe um e-mail válido: npm run admin:create -- --email voce@dominio.com --name "Seu Nome"');
  process.exit(1);
}

const db = await getDb();
const [existing] = await db.select().from(user).where(eq(user.email, email));
if (username) {
  const [taken] = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.username, username));
  if (taken && taken.email !== email) {
    console.error(`O usuário "${username}" já pertence a outra conta.`);
    process.exit(1);
  }
}
if (existing) {
  await db.update(user).set({ role, ...(username ? { username } : {}), updatedAt: new Date() }).where(eq(user.id, existing.id));
  await db.insert(auditLogs).values({ actorId: null, action: `user.promote.${role}`, entity: "user", entityId: existing.id, data: { via: "cli", username: username ?? null } });
  console.log(`Conta ${email} agora tem o papel "${role}"${username ? ` e o login "${username}"` : ""}.`);
  if (resetPassword) {
    const { password, generated } = await choosePassword();
    const hash = await hashPassword(password);
    const [acc] = await db.select({ id: account.id }).from(account).where(eq(account.userId, existing.id));
    if (acc) await db.update(account).set({ password: hash, updatedAt: new Date() }).where(eq(account.id, acc.id));
    else await db.insert(account).values({ id: randomUUID(), accountId: existing.id, providerId: "credential", userId: existing.id, password: hash });
    console.log("Senha alterada.");
    if (generated) console.log(`Senha gerada (exibida só agora — troque após o primeiro acesso): ${password}`);
  } else {
    console.log("A senha continua a mesma (use --nova-senha para trocar).");
  }
} else {
  if (!name) {
    console.error("Para criar uma conta nova, informe também --name.");
    process.exit(1);
  }
  const { password, generated } = await choosePassword();
  const id = randomUUID();
  await db.insert(user).values({ id, name, email, emailVerified: true, role, username: username ?? null });
  await db.insert(account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: await hashPassword(password) });
  await db.insert(auditLogs).values({ actorId: null, action: `user.create.${role}`, entity: "user", entityId: id, data: { via: "cli" } });
  console.log(`Conta "${role}" criada para ${email}.`);
  if (generated) console.log(`Senha gerada (exibida só agora — troque após o primeiro acesso): ${password}`);
}
await closeDb();
