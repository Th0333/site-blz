"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/safe-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError, FormNotice } from "@/components/forms/field";

export function ForgotForm({ emailEnabled, whatsapp }: { emailEnabled: boolean; whatsapp: string | null }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!emailEnabled) {
    return (
      <div className="mt-8 space-y-4">
        <FormNotice tone="merlot">
          O envio de e-mails ainda não foi configurado neste site, por isso não conseguimos mandar o link agora.
          {whatsapp ? " Fale com o estúdio pelo WhatsApp e ajudamos você a recuperar o acesso." : " Entre em contato com o estúdio para recuperar o acesso."}
        </FormNotice>
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-merlot underline underline-offset-4">
            Falar pelo WhatsApp
          </a>
        )}
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/redefinir-senha" });
    setPending(false);
    if (error && error.status === 429) return setError(authErrorMessage(error));
    // Resposta igual exista ou não a conta (evita descobrir e-mails cadastrados)
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-8 space-y-4">
        <FormNotice>Se houver uma conta com esse e-mail, você vai receber o link em alguns minutos. Confira também a caixa de spam.</FormNotice>
        <Link href="/entrar" className="text-sm font-semibold text-merlot underline underline-offset-4">Voltar para o login</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <FormError message={error} />
      <Field id="email" label="E-mail">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />} Enviar link
      </Button>
      <Link href="/entrar" className="block text-center text-sm text-muted-foreground underline underline-offset-4">Voltar para o login</Link>
    </form>
  );
}
