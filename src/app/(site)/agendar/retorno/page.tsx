import { redirect } from "next/navigation";
import { requireUserPage } from "@/server/session";
import { getBookingForUser } from "@/server/bookings";
import { syncBookingPayments } from "@/server/mercadopago";

/**
 * Retorno do Checkout Pro (sucesso, pendente ou falha).
 * Os parâmetros da URL NÃO são usados para aprovar nada: consultamos a API oficial
 * do Mercado Pago (mesma rotina do webhook) e mostramos o status registrado.
 */
export default async function ReturnPage({ searchParams }: PageProps<"/agendar/retorno">) {
  const sp = await searchParams;
  const id = typeof sp.agendamento === "string" ? sp.agendamento : "";
  const r = typeof sp.r === "string" ? sp.r : "retorno";
  const user = await requireUserPage(`/agendar/retorno?agendamento=${encodeURIComponent(id)}&r=${encodeURIComponent(r)}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/minha-conta");
  const row = await getBookingForUser(id, user.id);
  if (!row) redirect("/minha-conta");
  await syncBookingPayments(id).catch(() => undefined);
  redirect(`/agendar/confirmacao/${id}?r=${encodeURIComponent(r)}`);
}
