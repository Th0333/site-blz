import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { getDb } from "@/db";
import { bookings, professionals } from "@/db/schema";
import { PageHeader, EmptyState } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { Photo } from "@/components/site/photo";
import { mediaUrl } from "@/lib/media-url";

export const metadata = { title: "Profissionais" };

export default async function ProsAdmin() {
  const db = await getDb();
  const rows = await db
    .select({
      p: professionals,
      future: sql<number>`(select count(*) from ${bookings} b where b.professional_id = ${professionals.id} and b.starts_at > now() and b.status in ('pending_payment','scheduled','confirmed'))::int`,
      services: sql<number>`(select count(*) from service_professionals sp where sp.professional_id = ${professionals.id})::int`,
      days: sql<number>`(select count(*) from working_hours w where w.professional_id = ${professionals.id})::int`,
    })
    .from(professionals)
    .orderBy(asc(professionals.sortOrder), asc(professionals.displayName));

  return (
    <>
      <PageHeader title="Profissionais" description="Fotos, especialidades, serviços, jornada, folgas e bloqueios." actions={<Link href="/admin/profissionais/novo" className={buttonVariants()}><Plus className="size-4" /> Nova profissional</Link>} />
      {rows.length === 0 ? (
        <EmptyState title="Nenhuma profissional cadastrada" text="Cadastre a equipe para liberar o agendamento online." action={<Link href="/admin/profissionais/novo" className={buttonVariants()}>Cadastrar profissional</Link>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ p, future, services, days }) => (
            <li key={p.id}>
              <Link href={`/admin/profissionais/${p.id}`} className="flex gap-4 rounded-2xl border border-border/80 bg-card p-4 transition-shadow hover:shadow-md">
                <Photo src={mediaUrl(p.photoId)} alt="" className="aspect-[3/4] w-20 shrink-0 rounded-xl" sizes="80px" />
                <div className="min-w-0">
                  <p className="font-display text-2xl leading-tight text-petrol">{p.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.fullName}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{services} serviço(s) · {days} dia(s) de jornada · {future} agend. futuros</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${p.active ? "bg-teal-mist text-teal-deep" : "bg-zinc-100 text-zinc-600"}`}>{p.active ? "Ativa" : "Inativa"}</span>
                    {p.isDemo && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">Demonstração</span>}
                    {(services === 0 || days === 0) && p.active && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">Sem {services === 0 ? "serviços" : "jornada"}</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
