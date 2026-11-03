import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gt, inArray, or, isNull } from "drizzle-orm";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { getDb } from "@/db";
import { bookings, professionals, serviceProfessionals, services, timeOff, user, workingHours } from "@/db/schema";
import { PageHeader, Card } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { mediaUrl } from "@/lib/media-url";
import { hhmm } from "@/lib/time";
import { ProfessionalForm, HoursEditor, TimeOffManager } from "../forms";

export default async function ProEdit({ params }: PageProps<"/admin/profissionais/[id]">) {
  const { id } = await params;
  const db = await getDb();
  const allServices = await db.select({ id: services.id, name: services.name, active: services.active }).from(services).orderBy(asc(services.sortOrder));
  if (id === "novo") {
    return (
      <>
        <Link href="/admin/profissionais" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-petrol"><ArrowLeft className="size-4" /> Profissionais</Link>
        <PageHeader title="Nova profissional" description="Depois de salvar, defina a jornada de trabalho, intervalos e folgas." />
        <ProfessionalForm pro={null} services={allServices} />
      </>
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p] = await db.select().from(professionals).where(eq(professionals.id, id));
  if (!p) notFound();
  const links = await db.select().from(serviceProfessionals).where(eq(serviceProfessionals.professionalId, id));
  const hours = await db.select().from(workingHours).where(eq(workingHours.professionalId, id));
  const offs = await db.select().from(timeOff).where(and(or(eq(timeOff.professionalId, id), isNull(timeOff.professionalId)), gt(timeOff.endsAt, new Date()))).orderBy(asc(timeOff.startsAt));
  const [acc] = p.userId ? await db.select({ email: user.email }).from(user).where(eq(user.id, p.userId)) : [];
  const future = await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.professionalId, id), gt(bookings.startsAt, new Date()), inArray(bookings.status, ["pending_payment", "scheduled", "confirmed"])));

  return (
    <>
      <Link href="/admin/profissionais" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-petrol"><ArrowLeft className="size-4" /> Profissionais</Link>
      <PageHeader
        title={p.displayName}
        description={p.fullName}
        actions={<Link href={`/admin/agenda?profissional=${p.id}&visao=semana`} className={buttonVariants({ variant: "outline" })}><CalendarDays className="size-4" /> Ver agenda</Link>}
      />
      {!p.active && future.length > 0 && (
        <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Esta profissional está inativa e ainda tem {future.length} agendamento(s) futuro(s). Eles não foram cancelados automaticamente — reagende com outra profissional ou cancele em <Link className="underline" href={`/admin/agendamentos?profissional=${p.id}&quando=futuros`}>Agendamentos</Link>.
        </p>
      )}
      <ProfessionalForm
        pro={{
          id: p.id,
          fullName: p.fullName,
          displayName: p.displayName,
          specialties: p.specialties.join(", "),
          bio: p.bio,
          sortOrder: p.sortOrder,
          active: p.active,
          photo: mediaUrl(p.photoId),
          serviceIds: links.map((l) => l.serviceId),
          accountEmail: acc?.email ?? "",
          futureBookings: future.length,
        }}
        services={allServices}
      />
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Jornada semanal e intervalos">
          <HoursEditor
            professionalId={p.id}
            initial={[0, 1, 2, 3, 4, 5, 6].map((wd) => {
              const h = hours.find((x) => x.weekday === wd);
              return {
                weekday: wd,
                enabled: !!h,
                start: h ? hhmm(h.startMin) : "09:00",
                end: h ? hhmm(h.endMin) : "18:00",
                breakStart: h?.breakStartMin != null ? hhmm(h.breakStartMin) : "",
                breakEnd: h?.breakEndMin != null ? hhmm(h.breakEndMin) : "",
              };
            })}
          />
        </Card>
        <Card title="Folgas, férias e bloqueios">
          <TimeOffManager
            professionalId={p.id}
            items={offs.map((o) => ({ id: o.id, kind: o.kind, startsAt: o.startsAt.toISOString(), endsAt: o.endsAt.toISOString(), reason: o.reason, studioWide: !o.professionalId }))}
          />
        </Card>
      </div>
    </>
  );
}
