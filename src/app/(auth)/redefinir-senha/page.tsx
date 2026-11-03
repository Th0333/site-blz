"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/safe-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError, FormNotice } from "@/components/forms/field";

function ResetForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token");
  const tokenError = sp.get("error");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token || tokenError) {
    return (
      <div className="mt-8 space-y-4">
        <FormNotice tone="merlot">Este link é inválido ou expirou. Peça um novo link de recuperação.</FormNotice>
        <Link href="/recuperar-senha" className="text-sm font-semibold text-merlot underline underline-offset-4">Pedir novo link</Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p1 = String(fd.get("password"));
    const p2 = String(fd.get("confirm"));
    if (p1.length < 8) return setError("Use pelo menos 8 caracteres.");
    if (p1 !== p2) return setError("As senhas não conferem.");
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: p1, token: token! });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    router.replace("/entrar?redefinida=1");
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <FormError message={error} />
      <Field id="password" label="Nova senha" hint="Mínimo de 8 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field id="confirm" label="Repita a nova senha">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />} Salvar nova senha
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <p className="eyebrow text-teal">Quase lá</p>
      <h1 className="display mt-3 text-[2.9rem] text-petrol">Nova senha</h1>
      <Suspense>
        <ResetForm />
      </Suspense>
    </>
  );
}
