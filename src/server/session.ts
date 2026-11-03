import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/db";
import { professionals } from "@/db/schema";

export type Role = "client" | "professional" | "admin";
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  emailVerified: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user as typeof s.user & { role?: string; phone?: string | null };
  const role: Role = u.role === "admin" || u.role === "professional" ? u.role : "client";
  return { id: u.id, name: u.name, email: u.email, role, phone: u.phone ?? null, emailVerified: u.emailVerified };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: 401 | 403,
  ) {
    super(message);
  }
}

/** Para páginas: redireciona para o login preservando o destino. */
export async function requireUserPage(next: string) {
  const u = await getSessionUser();
  if (!u) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return u;
}

export async function requireAdminPage() {
  const u = await getSessionUser();
  if (!u) redirect(`/entrar?next=/admin`);
  if (u.role !== "admin") redirect(u.role === "professional" ? "/profissional" : "/minha-conta");
  return u;
}

/** Para server actions e rotas de API: lança erro em vez de redirecionar. */
export async function requireUser() {
  const u = await getSessionUser();
  if (!u) throw new AuthError("Faça login para continuar.", 401);
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "admin") throw new AuthError("Acesso restrito à administração.", 403);
  return u;
}

/** Profissional autenticada + o registro de profissional vinculado à conta. */
export async function requireProfessional() {
  const u = await requireUser();
  if (u.role !== "professional" && u.role !== "admin") throw new AuthError("Acesso restrito.", 403);
  const db = await getDb();
  const [pro] = await db.select().from(professionals).where(eq(professionals.userId, u.id));
  return { user: u, professional: pro ?? null };
}
