"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { faqs, galleryItems, testimonials } from "@/db/schema";
import { requireAdmin } from "@/server/session";
import { saveUploadedImage } from "@/server/media";
import { BusinessError, toResult } from "@/server/errors";
import { audit } from "@/server/events";

const uuid = z.string().uuid();
const refresh = () => revalidatePath("/", "layout");

export async function addGalleryAction(form: FormData) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new BusinessError("Selecione ao menos uma foto.");
    if (files.length > 12) throw new BusinessError("Envie no máximo 12 fotos por vez.");
    const caption = String(form.get("caption") ?? "").slice(0, 140) || null;
    const db = await getDb();
    for (const f of files) {
      const mediaId = await saveUploadedImage(f, admin.id, caption ?? "Trabalho do estúdio");
      await db.insert(galleryItems).values({ mediaId, caption, sortOrder: Date.now() % 100000 });
    }
    await audit(admin.id, "gallery.add", "gallery", null, { count: files.length });
    refresh();
  });
}

export async function updateGalleryAction(id: string, patch: { caption?: string; active?: boolean; sortOrder?: number }) {
  return toResult(async () => {
    await requireAdmin();
    const db = await getDb();
    await db.update(galleryItems).set({ caption: patch.caption?.slice(0, 140), active: patch.active, sortOrder: patch.sortOrder }).where(eq(galleryItems.id, uuid.parse(id)));
    refresh();
  });
}

export async function deleteGalleryAction(id: string) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    await db.delete(galleryItems).where(eq(galleryItems.id, uuid.parse(id)));
    await audit(admin.id, "gallery.delete", "gallery", id);
    refresh();
  });
}

const tSchema = z.object({ authorName: z.string().trim().min(2).max(80), text: z.string().trim().min(10).max(800), serviceLabel: z.string().max(80).optional(), rating: z.number().int().min(1).max(5).optional() });

export async function createTestimonialAction(input: z.infer<typeof tSchema>) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const d = tSchema.parse(input);
    const db = await getDb();
    await db.insert(testimonials).values({ ...d, serviceLabel: d.serviceLabel || null, approved: true });
    await audit(admin.id, "testimonial.create", "testimonial", null);
    refresh();
  });
}

export async function setTestimonialApprovedAction(id: string, approved: boolean) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    await db.update(testimonials).set({ approved }).where(eq(testimonials.id, uuid.parse(id)));
    await audit(admin.id, approved ? "testimonial.approve" : "testimonial.hide", "testimonial", id);
    refresh();
  });
}

export async function deleteTestimonialAction(id: string) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    await db.delete(testimonials).where(eq(testimonials.id, uuid.parse(id)));
    await audit(admin.id, "testimonial.delete", "testimonial", id);
    refresh();
  });
}

const fSchema = z.object({ question: z.string().trim().min(5).max(200), answer: z.string().trim().min(2).max(2000), sortOrder: z.number().int().min(0).max(9999), active: z.boolean() });

export async function saveFaqAction(id: string | null, input: z.infer<typeof fSchema>) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const d = fSchema.parse(input);
    const db = await getDb();
    if (id) await db.update(faqs).set({ ...d, isDemo: false }).where(eq(faqs.id, uuid.parse(id)));
    else await db.insert(faqs).values(d);
    await audit(admin.id, id ? "faq.update" : "faq.create", "faq", id);
    refresh();
  });
}

export async function deleteFaqAction(id: string) {
  return toResult(async () => {
    await requireAdmin();
    const db = await getDb();
    await db.delete(faqs).where(eq(faqs.id, uuid.parse(id)));
    refresh();
  });
}
