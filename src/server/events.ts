import { eq } from "drizzle-orm";
import { getDb, type Tx } from "@/db";
import { auditLogs, events, user, type EventType } from "@/db/schema";
import { emailLayout, sendEmail } from "./email";
import { appUrl } from "@/lib/env";

type EmitInput = {
  type: EventType;
  userId: string | null;
  bookingId?: string | null;
  title: string;
  body: string;
  /** Envia e-mail à cliente se houver serviço de e-mail configurado */
  email?: boolean;
  ctaPath?: string;
};

/**
 * Registra um evento (exibido na área da cliente) e tenta enviar e-mail real.
 * O status do e-mail fica gravado: sent | skipped | failed.
 */
export async function emitEvent(input: EmitInput) {
  const db = await getDb();
  const [ev] = await db
    .insert(events)
    .values({
      type: input.type,
      userId: input.userId,
      bookingId: input.bookingId ?? null,
      title: input.title,
      body: input.body,
    })
    .returning({ id: events.id });

  if (input.email && input.userId) {
    const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, input.userId));
    if (u) {
      const cta = input.ctaPath ? { label: "Abrir minha conta", url: `${appUrl()}${input.ctaPath}` } : undefined;
      const status = await sendEmail(u.email, input.title, input.body, emailLayout(input.title, input.body, cta));
      await db.update(events).set({ emailStatus: status }).where(eq(events.id, ev.id));
    }
  }
  return ev.id;
}

export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  data?: Record<string, unknown>,
  tx?: Tx,
) {
  const db = tx ?? (await getDb());
  await db.insert(auditLogs).values({ actorId, action, entity, entityId, data: data ?? null });
}
