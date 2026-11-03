"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/safe-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/field";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(fd.get("email")).trim(),
      password: String(fd.get("password")),
      rememberMe: true,
    });
    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
      <FormError message={error} />
      <Field id="email" label="E-mail">
        <Input id="email" name="email" type="email" autoComplete="email" required inputMode="email" />
      </Field>
      <Field id="password" label="Senha">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="flex justify-end">
        <Link href="/recuperar-senha" className="text-sm text-teal underline-offset-4 hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />} Entrar
      </Button>
      <p className="pt-2 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href={`/cadastro?next=${encodeURIComponent(next)}`} className="font-semibold text-merlot underline-offset-4 hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
