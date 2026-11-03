import type { Metadata } from "next";
import { emailConfigured } from "@/server/email";
import { getSettings } from "@/server/settings";
import { whatsappLink } from "@/lib/media-url";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default async function ForgotPage() {
  const s = await getSettings();
  return (
    <>
      <p className="eyebrow text-teal">Acontece com todo mundo</p>
      <h1 className="display mt-3 text-[2.9rem] text-petrol">Recuperar senha</h1>
      <p className="mt-3 text-muted-foreground">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
      <ForgotForm emailEnabled={emailConfigured()} whatsapp={whatsappLink(s.whatsapp, "Olá! Preciso de ajuda para acessar minha conta.")} />
    </>
  );
}
