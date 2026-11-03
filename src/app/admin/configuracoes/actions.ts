"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/session";
import { getSettings, saveSettings } from "@/server/settings";
import { imageFromForm } from "@/server/media";
import { removeDemoData, seedDemo } from "@/server/demo";
import { toResult } from "@/server/errors";
import { audit } from "@/server/events";
import type { StudioSettings } from "@/lib/settings-schema";

const TEXT_FIELDS = [
  "studioName", "tagline", "heroEyebrow", "heroTitle", "heroSubtitle", "aboutTitle", "aboutText",
  "address", "mapsUrl", "whatsapp", "instagram", "email", "phone", "cancellationPolicy", "privacyPolicy", "termsOfUse",
] as const;
const NUM_FIELDS = ["slotIntervalMin", "minNoticeHours", "maxDaysAhead", "holdMinutes", "cancelMinHours", "rescheduleMinHours"] as const;
const IMAGE_FIELDS = ["logoId", "logoLightId", "heroImageId", "heroSecondaryImageId", "aboutImageId"] as const;

export async function saveSettingsAction(form: FormData) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const current = await getSettings();
    const patch: Record<string, unknown> = {};
    const section = String(form.get("_section") ?? "");
    for (const k of TEXT_FIELDS) if (form.has(k)) patch[k] = String(form.get(k) ?? "");
    for (const k of NUM_FIELDS) if (form.has(k)) patch[k] = Number(form.get(k));
    // Checkboxes só são considerados na seção que os exibe (ausente = desmarcado)
    if (section === "agenda") for (const k of ["allowAnyProfessional", "allowClientCancel", "allowClientReschedule"] as const) patch[k] = form.get(k) === "on";
    if (section === "pagamentos") for (const k of ["onlinePaymentEnabled", "inPersonPaymentEnabled"] as const) patch[k] = form.get(k) === "on";
    for (const k of IMAGE_FIELDS) {
      const id = await imageFromForm(form, k, admin.id, current.studioName);
      if (id) patch[k] = id;
      else if (form.get(`remove_${k}`) === "1") patch[k] = null;
    }
    if (form.has("highlightTitle")) {
      const titles = form.getAll("highlightTitle").map(String);
      const texts = form.getAll("highlightText").map(String);
      patch.highlights = titles.map((t, i) => ({ title: t.trim(), text: (texts[i] ?? "").trim() })).filter((h) => h.title);
    }
    if (form.has("hoursLabel")) {
      const labels = form.getAll("hoursLabel").map(String);
      const hours = form.getAll("hoursValue").map(String);
      patch.openingHours = labels.map((l, i) => ({ label: l.trim(), hours: (hours[i] ?? "").trim() })).filter((h) => h.label);
    }
    if (typeof patch.whatsapp === "string") patch.whatsapp = (patch.whatsapp as string).replace(/\D/g, "");
    await saveSettings(patch as Partial<StudioSettings>, admin.id);
    await audit(admin.id, "settings.update", "settings", "1", { section, fields: Object.keys(patch) });
    revalidatePath("/", "layout");
  });
}

export async function removeDemoAction() {
  return toResult(async () => {
    const admin = await requireAdmin();
    await removeDemoData();
    await audit(admin.id, "demo.remove", "settings", null);
    revalidatePath("/", "layout");
  });
}

export async function loadDemoAction() {
  return toResult(async () => {
    const admin = await requireAdmin();
    const r = await seedDemo(admin.id);
    await audit(admin.id, "demo.load", "settings", null);
    revalidatePath("/", "layout");
    return r;
  });
}
