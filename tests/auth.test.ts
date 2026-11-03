import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { user } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { freshDb } from "./helpers";

let db: DB;
beforeAll(async () => {
  process.env.BETTER_AUTH_SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
  db = await freshDb();
});

describe("cadastro público", () => {
  it("não permite definir papel nem nome de usuário (ex.: tomar o login 'admin')", async () => {
    const auth = await getAuth();
    await auth.api.signUpEmail({
      body: { name: "Invasora Teste", email: "invasora@teste.dev", password: "SenhaForte#123", username: "admin", role: "admin" } as never,
    });
    const [u] = await db.select().from(user).where(eq(user.email, "invasora@teste.dev"));
    expect(u.role).toBe("client");
    expect(u.username).toBeNull();
  });

  it("login por nome de usuário funciona para contas definidas pela administração", async () => {
    const auth = await getAuth();
    await auth.api.signUpEmail({ body: { name: "Dona Teste", email: "dona@teste.dev", password: "SenhaForte#123" } });
    await db.update(user).set({ username: "admin", role: "admin" }).where(eq(user.email, "dona@teste.dev"));
    const r = await auth.api.signInUsername({ body: { username: "admin", password: "SenhaForte#123" } });
    expect(r?.user?.email).toBe("dona@teste.dev");
    await expect(auth.api.signInUsername({ body: { username: "admin", password: "errada123" } })).rejects.toThrow();
  });
});
