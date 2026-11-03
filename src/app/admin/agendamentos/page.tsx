import Link from "next/link";
import { and, asc, desc, eq, gte, ilike, lt, or, type SQL } from "drizzle-orm";
import { Plus } from "lucide-react";
import { getDb } from "@/db";
import { BOOKING_STATUSES, PAYMENT_STATUSES, bookings, professionals, user } from "@/db/schema";
import { expireStaleHolds } from "@/server/availability";
import { PageHeader, Table, Th, Td, EmptyState, selectClass } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { BOOKING_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/labels";
import { formatBRL } from "@/lib/money";
import { addDaysYmd, fmtDate, fmtTime, isValidYmd, zonedToDate } from "@/lib/time";

export const metadata = { title: "Agendamentos" };

export default async function BookingsAdmin({ searchParams }: PageProps<"/admin/agendamentos">) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = get("q").trim();
  const status = get("status");
  const pay = get("pagamento");
  const pro = get("profissional");
  const when = get("quando") || "futuros";
  const de = get("de");
  const ate = get("ate");

  await expireStaleHolds();
  const db = await getDb();
  const conds: SQL[] = [];
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(user.name, like), ilike(user.email, like), ilike(bookings.code, like), ilike(user.phone, like))!);
  }
  if ((BOOKING_STATUSES as readonly string[]).includes(status)) conds.push(eq(bookings.status, status as never));
  if ((PAYMENT_STATUSES as readonly string[]).includes(pay)) conds.push(eq(bookings.paymentStatus, pay as never));
  if (/^[0-9a-f-]{36}$/i.test(pro)) conds.push(eq(bookings.professionalId, pro));
  if (when === "futuros") conds.push(gte(bookings.startsAt, new Date()));
  if (when === "passados") conds.push(lt(bookings.startsAt, new Date()));
  if (isValidYmd(de)) conds.push(gte(bookings.startsAt, zonedToDate(de, 0)));
  if (isValidYmd(ate)) conds.push(lt(bookings.startsAt, zonedToDate(addDaysYmd(ate, 1), 0)));

  const rows = await db
    .select({ b: bookings, client: user.name, email: user.email, pro: professionals.displayName })
    .from(bookings)
    .innerJoin(user, eq(user.id, bookings.clientId))
    .innerJoin(professionals, eq(professionals.id, bookings.professionalId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(when === "futuros" ? asc(bookings.startsAt) : desc(bookings.startsAt))
    .limit(200);
  const pros = await db.select({ id: professionals.id, name: professionals.displayName }).from(professionals).orderBy(asc(professionals.displayName));

  return (
    <>
      <PageHeader title="Agendamentos" description="Status do atendimento e status financeiro são independentes." actions={<Link href="/admin/agenda?novo=1" className={buttonVariants()}><Plus className="size-4" /> Novo agendamento</Link>} />
      <form className="mb-5 grid gap-2 rounded-2xl border border-border/80 bg-card p-4 sm:grid-cols-2 lg:grid-cols-7" role="search">
        <input name="q" defaultValue={q} placeholder="Cliente, e-mail, telefone ou código" className={`${selectClass} lg:col-span-2`} aria-label="Buscar" />
        <select name="quando" defaultValue={when} className={selectClass} aria-label="Período">
          <option value="futuros">Próximos</option>
          <option value="passados">Passados</option>
          <option value="todos">Todos</option>
        </select>
        <select name="status" defaultValue={status} className={selectClass} aria-label="Status do atendimento">
          <option value="">Todos os status</option>
          {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{BOOKING_STATUS_LABEL[s]}</option>)}
        </select>
        <select name="pagamento" defaultValue={pay} className={selectClass} aria-label="Status do pagamento">
          <option value="">Todos pagamentos</option>
          {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>)}
        </select>
        <select name="profissional" defaultValue={pro} className={selectClass} aria-label="Profissional">
          <option value="">Todas profissionais</option>
          {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className={buttonVariants({ variant: "teal" })}>Filtrar</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Nenhum agendamento encontrado" text="Ajuste os filtros ou crie um agendamento manual." />
      ) : (
        <Table>
          <thead>
            <tr><Th>Quando</Th><Th>Cliente</Th><Th>Serviço</Th><Th>Profissional</Th><Th>Valor</Th><Th>Atendimento</Th><Th>Pagamento</Th></tr>
          </thead>
          <tbody>
            {rows.map(({ b, client, email, pro }) => (
              <tr key={b.id} className="hover:bg-muted/30">
                <Td><Link href={`/admin/agendamentos/${b.id}`} className="font-medium text-petrol hover:underline">{fmtDate(b.startsAt)}<span className="block text-xs text-muted-foreground">{fmtTime(b.startsAt)} · {b.code}</span></Link></Td>
                <Td>{client}<span className="block text-xs text-muted-foreground">{email}</span></Td>
                <Td>{b.serviceName}</Td>
                <Td>{pro}</Td>
                <Td>{formatBRL(b.priceCents)}<span className="block text-xs text-muted-foreground">{b.paymentMethod === "online" ? "Online" : "No dia"}</span></Td>
                <Td><StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} /></Td>
                <Td><StatusBadge status={b.paymentStatus} label={PAYMENT_STATUS_LABEL[b.paymentStatus]} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {rows.length === 200 && <p className="mt-3 text-xs text-muted-foreground">Mostrando os 200 primeiros resultados. Refine os filtros.</p>}
    </>
  );
}
