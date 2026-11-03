import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { getDb } from "@/db";
import { serviceProfessionals, services } from "@/db/schema";
import { PageHeader, Table, Th, Td, EmptyState } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { Photo } from "@/components/site/photo";
import { formatBRL } from "@/lib/money";
import { fmtDuration } from "@/lib/time";
import { mediaUrl } from "@/lib/media-url";
import { RowToggles } from "./row-toggles";

export const metadata = { title: "Serviços" };

export default async function ServicesAdmin() {
  const db = await getDb();
  const rows = await db
    .select({ s: services, pros: sql<number>`(select count(*) from ${serviceProfessionals} sp where sp.service_id = ${services.id})::int` })
    .from(services)
    .orderBy(asc(services.sortOrder), asc(services.name));

  return (
    <>
      <PageHeader
        title="Serviços"
        description="Preço e duração valem para novos agendamentos. Agendamentos já feitos mantêm o valor e a descrição da época."
        actions={<Link href="/admin/servicos/novo" className={buttonVariants()}><Plus className="size-4" /> Novo serviço</Link>}
      />
      {rows.length === 0 ? (
        <EmptyState title="Nenhum serviço cadastrado" text="Cadastre os serviços que o estúdio oferece para que apareçam no site e no agendamento." action={<Link href="/admin/servicos/novo" className={buttonVariants()}>Cadastrar serviço</Link>} />
      ) : (
        <Table>
          <thead>
            <tr><Th>Serviço</Th><Th>Preço</Th><Th>Duração</Th><Th>Profissionais</Th><Th>Ordem</Th><Th>Ativo</Th><Th>Destaque</Th></tr>
          </thead>
          <tbody>
            {rows.map(({ s, pros }) => (
              <tr key={s.id} className="hover:bg-muted/30">
                <Td>
                  <Link href={`/admin/servicos/${s.id}`} className="flex items-center gap-3">
                    <Photo src={mediaUrl(s.photoId)} alt="" className="size-12 shrink-0 rounded-lg" sizes="48px" />
                    <span>
                      <span className="block font-medium text-petrol hover:underline">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.category}{s.isDemo && " · demonstração"}</span>
                    </span>
                  </Link>
                </Td>
                <Td>{s.priceFrom && <span className="text-xs text-muted-foreground">a partir de </span>}{formatBRL(s.priceCents)}</Td>
                <Td>{fmtDuration(s.durationMin)}{s.bufferMin > 0 && <span className="block text-xs text-muted-foreground">+{s.bufferMin} min preparo</span>}</Td>
                <Td>{pros === 0 ? <span className="text-xs font-medium text-red-700">Nenhuma — não agendável</span> : pros}</Td>
                <Td>{s.sortOrder}</Td>
                <RowToggles id={s.id} active={s.active} featured={s.featured} />
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
