import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/session";
import { safeNext } from "@/lib/safe-next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const user = await getSessionUser();
  if (user) redirect(next);
  return (
    <>
      <p className="eyebrow text-teal">Bem-vinda de volta</p>
      <h1 className="display mt-3 text-[2.9rem] text-petrol">Entrar</h1>
      <p className="mt-3 text-muted-foreground">
        {next.startsWith("/agendar") ? "Entre para concluir seu agendamento — suas escolhas ficam guardadas." : "Acesse seus agendamentos e pagamentos."}
      </p>
      <SignInForm next={next} />
    </>
  );
}
