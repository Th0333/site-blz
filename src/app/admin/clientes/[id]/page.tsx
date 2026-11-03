import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { getDb } from "@/db";
import { bookings, professionals, user } from "@/db/schema";
import { PageHeader, Card, Table, Th, Td } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import { BOOKING_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/labels";
import { formatBRL } from "@/lib/money";
import { fmtDate, fmtTime } from "@/lib/time";
import { whatsappLink } from "@/lib/media-url";

export default async function ClientDetail({ params }: PageProps<"/admin/clientes/[id]">) {
  const { id } = await params;
  const db = await getDb();
  const [u] = await db.select().from(user).where(eq(user.id, id));
  if (!u) notFound();
  const list = await db
    .select({ b: bookings, pro: professionals.displayName })
    .from(bookings)
    .innerJoin(professionals, eq(professionals.id, bookings.professionalId))
    .where(eq(bookings.clientId, id))
    .orderBy(desc(bookings.startsAt));
  const wa = u.phone ? whatsappLink(u.phone.length <= 11 ? `55${u.phone}` : u.phone) : null;
  return (
    <>
      <Link href="/admin/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-petrol"><ArrowLeft className="size-4" /> Clientes</Link>
      <PageHeader title={u.name} description={`${u.email}${u.phone ? ` · ${u.phone}` : ""} · cliente desde ${fmtDate(u.createdAt)}`} actions={wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className="text-sm text-teal underline">Abrir WhatsApp</a> : undefined} />
      <Card title={`Agendamentos (${list.length})`}>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum agendamento.</p>
        ) : (
          <Table className="border-0">
            <thead><tr><Th>Data</Th><Th>Serviço</Th><Th>Profissional</Th><Th>Valor</Th><Th>Atendimento</Th><Th>Pagamento</Th></tr></thead>
            <tbody>
              {list.map(({ b, pro }) => (
                <tr key={b.id}>
                  <Td><Link href={`/admin/agendamentos/${b.id}`} className="text-petrol hover:underline">{fmtDate(b.startsAt)} {fmtTime(b.startsAt)}</Link></Td>
                  <Td>{b.serviceName}</Td>
                  <Td>{pro}</Td>
                  <Td>{formatBRL(b.priceCents)}</Td>
                  <Td><StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} /></Td>
                  <Td><StatusBadge status={b.paymentStatus} label={PAYMENT_STATUS_LABEL[b.paymentStatus]} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
