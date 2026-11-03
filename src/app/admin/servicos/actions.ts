"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, ne, and } from "drizzle-orm";
import { getDb } from "@/db";
import { serviceProfessionals, services } from "@/db/schema";
import { requireAdmin } from "@/server/session";
import { imageFromForm } from "@/server/media";
import { BusinessError, toResult } from "@/server/errors";
import { audit } from "@/server/events";
import { parseBRL } from "@/lib/money";
import { slugify } from "@/lib/slug";

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  category: z.string().trim().min(2).max(40),
  description: z.string().trim().max(600),
  durationMin: z.coerce.number().int().min(5).max(720),
  bufferMin: z.coerce.number().int().min(0).max(240),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export async function saveServiceAction(id: string | null, form: FormData) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const data = schema.parse({
      name: form.get("name"),
      category: form.get("category"),
      description: form.get("description") ?? "",
      durationMin: form.get("durationMin"),
      bufferMin: form.get("bufferMin") || 0,
      sortOrder: form.get("sortOrder") || 0,
    });
    const priceCents = parseBRL(String(form.get("price") ?? ""));
    if (priceCents === null) throw new BusinessError("Informe um preço válido (ex.: 180,00).");
    const proIds = form.getAll("professionals").map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
    const photoId = await imageFromForm(form, "photo", admin.id, data.name);
    const removePhoto = form.get("removePhoto") === "1";
    const values = {
      ...data,
      priceCents,
      priceFrom: form.get("priceFrom") === "on",
      active: form.get("active") === "on",
      featured: form.get("featured") === "on",
      updatedAt: new Date(),
      ...(photoId ? { photoId } : removePhoto ? { photoId: null } : {}),
    };
    const db = await getDb();
    const savedId = await db.transaction(async (tx) => {
      let base = slugify(data.name);
      const clash = await tx.select({ id: services.id }).from(services).where(and(eq(services.slug, base), id ? ne(services.id, id) : undefined));
      if (clash.length) base = `${base}-${Date.now().toString(36).slice(-4)}`;
      let sid = id;
      if (id) {
        const [u] = await tx.update(services).set({ ...values, slug: base }).where(eq(services.id, id)).returning({ id: services.id });
        if (!u) throw new BusinessError("Serviço não encontrado.");
      } else {
        const [c] = await tx.insert(services).values({ ...values, slug: base }).returning({ id: services.id });
        sid = c.id;
      }
      await tx.delete(serviceProfessionals).where(eq(serviceProfessionals.serviceId, sid!));
      if (proIds.length) await tx.insert(serviceProfessionals).values(proIds.map((professionalId) => ({ serviceId: sid!, professionalId })));
      await audit(admin.id, id ? "service.update" : "service.create", "service", sid, { name: data.name, priceCents, durationMin: data.durationMin }, tx);
      return sid!;
    });
    revalidatePath("/", "layout");
    return { id: savedId };
  });
}

export async function toggleServiceAction(id: string, field: "active" | "featured", value: boolean) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    await db.update(services).set({ [field]: value, updatedAt: new Date() }).where(eq(services.id, z.string().uuid().parse(id)));
    await audit(admin.id, `service.${field}`, "service", id, { value });
    revalidatePath("/", "layout");
  });
}

/** Exclui o serviço. Agendamentos antigos mantêm nome, descrição e preço registrados (snapshot). */
export async function deleteServiceAction(id: string) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    await db.delete(services).where(eq(services.id, z.string().uuid().parse(id)));
    await audit(admin.id, "service.delete", "service", id);
    revalidatePath("/", "layout");
  });
}
