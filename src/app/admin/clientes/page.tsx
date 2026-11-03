import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, user } from "@/db/schema";
import { PageHeader, Table, Th, Td, EmptyState, selectClass } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { fmtDate } from "@/lib/time";

export const metadata = { title: "Clientes" };

export default async function ClientsAdmin({ searchParams }: PageProps<"/admin/clientes">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const db = await getDb();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const rows = await db
    .select({
      u: user,
      total: sql<number>`count(${bookings.id}) filter (where ${bookings.status} not in ('expired'))::int`,
      done: sql<number>`count(${bookings.id}) filter (where ${bookings.status} = 'completed')::int`,
      spent: sql<number>`coalesce((select sum(fe.amount_cents) from financial_entries fe join bookings b2 on b2.id = fe.booking_id where b2.client_id = ${user.id}), 0)::int`,
      last: sql<Date | null>`max(${bookings.startsAt})`,
    })
    .from(user)
    .leftJoin(bookings, eq(bookings.clientId, user.id))
    .where(and(eq(user.role, "client"), q ? or(ilike(user.name, like), ilike(user.email, like), ilike(user.phone, like)) : undefined))
    .groupBy(user.id)
    .orderBy(desc(user.createdAt))
    .limit(300);

  return (
    <>
      <PageHeader title="Clientes" description="Contas de clientes, histórico e valores pagos (somente recebimentos confirmados)." />
      <form className="mb-5 flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Nome, e-mail ou telefone" className={`${selectClass} max-w-md`} aria-label="Buscar clientes" />
        <button className={buttonVariants({ variant: "teal" })}>Buscar</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="Nenhuma cliente encontrada" text={q ? "Tente outro termo de busca." : "As clientes aparecem aqui ao criarem conta ou serem cadastradas num agendamento manual."} />
      ) : (
        <Table>
          <thead><tr><Th>Cliente</Th><Th>Telefone</Th><Th>Agendamentos</Th><Th>Concluídos</Th><Th>Total pago</Th><Th>Último</Th><Th>Desde</Th></tr></thead>
          <tbody>
            {rows.map(({ u, total, done, spent, last }) => (
              <tr key={u.id} className="hover:bg-muted/30">
                <Td><Link href={`/admin/clientes/${u.id}`} className="font-medium text-petrol hover:underline">{u.name}</Link><span className="block text-xs text-muted-foreground">{u.email}</span></Td>
                <Td>{u.phone ?? "—"}</Td>
                <Td>{total}</Td>
                <Td>{done}</Td>
                <Td>{formatBRL(spent)}</Td>
                <Td>{last ? fmtDate(new Date(last)) : "—"}</Td>
                <Td>{fmtDate(u.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
