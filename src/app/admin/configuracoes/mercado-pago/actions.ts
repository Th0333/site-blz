"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { clearCredentials, saveCredentials, testConnection } from "@/server/mercadopago";
import { saveSettings } from "@/server/settings";
import { toResult } from "@/server/errors";
import { audit } from "@/server/events";

const schema = z.object({
  environment: z.enum(["test", "production"]),
  publicKey: z.string().trim().max(200).optional(),
  accessToken: z.string().trim().max(300).optional(),
  webhookSecret: z.string().trim().max(300).optional(),
});

/** O Access Token é enviado só ao backend autenticado, guardado criptografado e nunca devolvido ao navegador. */
export async function saveCredentialsAction(input: z.infer<typeof schema>) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const d = schema.parse(input);
    await saveCredentials({ environment: d.environment, publicKey: d.publicKey ?? undefined, accessToken: d.accessToken || null, webhookSecret: d.webhookSecret || null }, admin.id);
    await audit(admin.id, "mp.credentials.save", "integration", "mercadopago", { environment: d.environment, accessToken: !!d.accessToken, webhookSecret: !!d.webhookSecret });
    revalidatePath("/admin/configuracoes/mercado-pago");
  });
}

export async function testConnectionAction() {
  return toResult(async () => {
    const admin = await requireAdmin();
    const r = await testConnection(admin.id);
    revalidatePath("/admin/configuracoes/mercado-pago");
    return r;
  });
}

export async function clearCredentialsAction() {
  return toResult(async () => {
    const admin = await requireAdmin();
    await clearCredentials(admin.id);
    await saveSettings({ onlinePaymentEnabled: false }, admin.id);
    await audit(admin.id, "mp.credentials.clear", "integration", "mercadopago");
    revalidatePath("/", "layout");
  });
}

export async function setPaymentMethodsAction(online: boolean, inPerson: boolean) {
  return toResult(async () => {
    const admin = await requireAdmin();
    await saveSettings({ onlinePaymentEnabled: online, inPersonPaymentEnabled: inPerson }, admin.id);
    await audit(admin.id, "settings.payments", "settings", "1", { online, inPerson });
    revalidatePath("/", "layout");
  });
}
