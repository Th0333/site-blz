/**
 * Cria (ou promove) a conta de ADMINISTRADORA. Não existe cadastro público de administradores.
 *
 *   npm run admin:create -- --email dona@estudio.com.br --name "Nome Completo"
 *
 * - Se o e-mail já tiver conta de cliente, ela é promovida a administradora (a senha não muda).
 * - Se não existir, a conta é criada. A senha é pedida no terminal (não fica no histórico);
 *   sem terminal interativo, uma senha forte é gerada e exibida uma única vez.
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
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Informe um e-mail válido: npm run admin:create -- --email voce@dominio.com --name "Seu Nome"');
  process.exit(1);
}

const db = await getDb();
const [existing] = await db.select().from(user).where(eq(user.email, email));
if (existing) {
  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, existing.id));
  await db.insert(auditLogs).values({ actorId: null, action: `user.promote.${role}`, entity: "user", entityId: existing.id, data: { via: "cli" } });
  console.log(`Conta ${email} agora tem o papel "${role}". A senha continua a mesma.`);
} else {
  if (!name) {
    console.error("Para criar uma conta nova, informe também --name.");
    process.exit(1);
  }
  let password = await askHidden("Defina a senha (mín. 10 caracteres): ");
  let generated = false;
  if (!password) {
    password = randomBytes(12).toString("base64url");
    generated = true;
  }
  if (password.length < 10) {
    console.error("Senha muito curta.");
    process.exit(1);
  }
  const id = randomUUID();
  await db.insert(user).values({ id, name, email, emailVerified: true, role });
  await db.insert(account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: await hashPassword(password) });
  await db.insert(auditLogs).values({ actorId: null, action: `user.create.${role}`, entity: "user", entityId: id, data: { via: "cli" } });
  console.log(`Conta "${role}" criada para ${email}.`);
  if (generated) console.log(`Senha gerada (exibida só agora — troque após o primeiro acesso): ${password}`);
}
await closeDb();
