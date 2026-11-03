"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/safe-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError, FormNotice } from "@/components/forms/field";

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function SignUpForm({ next, requireVerification }: { next: string; requireVerification: boolean }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name")).trim();
    const email = String(fd.get("email")).trim().toLowerCase();
    const password = String(fd.get("password"));
    const errs: Record<string, string> = {};
    if (name.split(/\s+/).length < 2) errs.name = "Informe nome e sobrenome.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.email = "Informe um e-mail válido.";
    if (phone.replace(/\D/g, "").length < 10) errs.phone = "Informe um telefone com DDD.";
    if (password.length < 8) errs.password = "Use pelo menos 8 caracteres.";
    if (!fd.get("terms")) errs.terms = "É preciso aceitar os termos e a política de privacidade.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setPending(true);
    setFormError(null);
    const { error } = await authClient.signUp.email({ name, email, password, phone: phone.replace(/\D/g, ""), callbackURL: next });
    if (error) {
      setFormError(authErrorMessage(error));
      setPending(false);
      return;
    }
    if (requireVerification) {
      setSentTo(email);
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  if (sentTo) {
    return (
      <div className="mt-8 space-y-4">
        <FormNotice>
          <span className="flex items-start gap-3">
            <MailCheck className="mt-0.5 size-5 shrink-0" />
            <span>
              Enviamos um link de confirmação para <strong>{sentTo}</strong>. Abra o e-mail para ativar sua conta — suas escolhas de agendamento continuam guardadas.
            </span>
          </span>
        </FormNotice>
        <Link href={`/entrar?next=${encodeURIComponent(next)}`} className="text-sm font-semibold text-merlot underline underline-offset-4">
          Já confirmei, quero entrar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
      <FormError message={formError} />
      <Field id="name" label="Nome completo" error={errors.name}>
        <Input id="name" name="name" autoComplete="name" required aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} />
      </Field>
      <Field id="email" label="E-mail" error={errors.email}>
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} />
      </Field>
      <Field id="phone" label="Celular (WhatsApp)" error={errors.phone}>
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 98765-4321" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} required aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-error" : undefined} />
      </Field>
      <Field id="password" label="Senha" hint="Mínimo de 8 caracteres." error={errors.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : "password-hint"} />
      </Field>
      <div>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
          <input type="checkbox" name="terms" className="mt-1 size-4 accent-[var(--brand-merlot)]" aria-invalid={!!errors.terms} />
          <span>
            Li e aceito os <Link href="/termos" target="_blank" className="text-teal underline">termos de uso</Link> e a{" "}
            <Link href="/privacidade" target="_blank" className="text-teal underline">política de privacidade</Link>.
          </span>
        </label>
        {errors.terms && <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">{errors.terms}</p>}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />} Criar conta
      </Button>
      <p className="pt-2 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href={`/entrar?next=${encodeURIComponent(next)}`} className="font-semibold text-merlot underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
