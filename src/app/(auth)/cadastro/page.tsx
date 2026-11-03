import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/session";
import { safeNext } from "@/lib/safe-next";
import { REQUIRE_EMAIL_VERIFICATION } from "@/lib/auth";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage({ searchParams }: PageProps<"/cadastro">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  if (await getSessionUser()) redirect(next);
  return (
    <>
      <p className="eyebrow text-teal">Leva menos de um minuto</p>
      <h1 className="display mt-3 text-[2.9rem] text-petrol">Criar conta</h1>
      <p className="mt-3 text-muted-foreground">Com a conta você agenda, acompanha pagamentos e remarca quando precisar.</p>
      <SignUpForm next={next} requireVerification={REQUIRE_EMAIL_VERIFICATION} />
    </>
  );
}
