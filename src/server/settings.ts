import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { studioSettings } from "@/db/schema";
import { settingsSchema, type StudioSettings } from "@/lib/settings-schema";

/** Memoizado por requisição: layout, metadata e página compartilham uma única consulta. */
export const getSettings = cache(async function getSettings(): Promise<StudioSettings> {
  const db = await getDb();
  const [row] = await db.select().from(studioSettings).where(eq(studioSettings.id, 1));
  const parsed = settingsSchema.safeParse(row?.data ?? {});
  return parsed.success ? parsed.data : settingsSchema.parse({});
});

export async function saveSettings(patch: Partial<StudioSettings>, actorId: string | null) {
  const db = await getDb();
  const [row] = await db.select().from(studioSettings).where(eq(studioSettings.id, 1));
  const current = settingsSchema.parse(row?.data ?? {});
  const next = settingsSchema.parse({ ...current, ...patch });
  await db
    .insert(studioSettings)
    .values({ id: 1, data: next, updatedBy: actorId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: studioSettings.id,
      set: { data: next, updatedBy: actorId, updatedAt: new Date() },
    });
  return next;
}
