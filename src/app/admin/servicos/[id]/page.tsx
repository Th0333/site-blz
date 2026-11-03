import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { getDb } from "@/db";
import { professionals, serviceProfessionals, services } from "@/db/schema";
import { PageHeader } from "@/components/admin/ui";
import { mediaUrl } from "@/lib/media-url";
import { ServiceForm } from "../service-form";

export default async function ServiceEdit({ params }: PageProps<"/admin/servicos/[id]">) {
  const { id } = await params;
  const db = await getDb();
  const pros = await db.select({ id: professionals.id, name: professionals.displayName, active: professionals.active }).from(professionals).orderBy(asc(professionals.sortOrder));
  const cats = (await db.selectDistinct({ c: services.category }).from(services)).map((r) => r.c);
  let svc = null;
  if (id !== "novo") {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
    const [s] = await db.select().from(services).where(eq(services.id, id));
    if (!s) notFound();
    const links = await db.select().from(serviceProfessionals).where(eq(serviceProfessionals.serviceId, id));
    svc = {
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
      price: (s.priceCents / 100).toFixed(2).replace(".", ","),
      priceFrom: s.priceFrom,
      durationMin: s.durationMin,
      bufferMin: s.bufferMin,
      sortOrder: s.sortOrder,
      active: s.active,
      featured: s.featured,
      photo: mediaUrl(s.photoId),
      professionalIds: links.map((l) => l.professionalId),
    };
  }
  return (
    <>
      <Link href="/admin/servicos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-petrol"><ArrowLeft className="size-4" /> Serviços</Link>
      <PageHeader title={svc ? svc.name : "Novo serviço"} />
      <ServiceForm svc={svc} pros={pros} categories={cats} />
    </>
  );
}
