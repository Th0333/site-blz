import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { faqs, galleryItems, professionals, serviceProfessionals, services, testimonials } from "@/db/schema";
import { mediaUrl } from "@/lib/media-url";

export type PublicService = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  priceCents: number;
  priceFrom: boolean;
  durationMin: number;
  featured: boolean;
  photo: string | null;
  professionalIds: string[];
};

export async function getPublicServices(): Promise<PublicService[]> {
  const db = await getDb();
  const rows = await db.select().from(services).where(eq(services.active, true)).orderBy(asc(services.sortOrder), asc(services.name));
  const links = rows.length
    ? await db
        .select({ s: serviceProfessionals.serviceId, p: serviceProfessionals.professionalId })
        .from(serviceProfessionals)
        .innerJoin(professionals, eq(professionals.id, serviceProfessionals.professionalId))
        .where(and(inArray(serviceProfessionals.serviceId, rows.map((r) => r.id)), eq(professionals.active, true)))
    : [];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    category: r.category,
    description: r.description,
    priceCents: r.priceCents,
    priceFrom: r.priceFrom,
    durationMin: r.durationMin,
    featured: r.featured,
    photo: mediaUrl(r.photoId),
    professionalIds: links.filter((l) => l.s === r.id).map((l) => l.p),
  }));
}

export type PublicProfessional = {
  id: string;
  displayName: string;
  slug: string;
  specialties: string[];
  bio: string;
  photo: string | null;
  serviceIds: string[];
};

export async function getPublicProfessionals(): Promise<PublicProfessional[]> {
  const db = await getDb();
  const rows = await db.select().from(professionals).where(eq(professionals.active, true)).orderBy(asc(professionals.sortOrder), asc(professionals.displayName));
  const links = rows.length
    ? await db
        .select({ s: serviceProfessionals.serviceId, p: serviceProfessionals.professionalId })
        .from(serviceProfessionals)
        .innerJoin(services, eq(services.id, serviceProfessionals.serviceId))
        .where(and(inArray(serviceProfessionals.professionalId, rows.map((r) => r.id)), eq(services.active, true)))
    : [];
  return rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    slug: r.slug,
    specialties: r.specialties,
    bio: r.bio,
    photo: mediaUrl(r.photoId),
    serviceIds: links.filter((l) => l.p === r.id).map((l) => l.s),
  }));
}

export async function getPublicContent() {
  const db = await getDb();
  const [t, g, f] = await Promise.all([
    db.select().from(testimonials).where(eq(testimonials.approved, true)).orderBy(asc(testimonials.sortOrder)).limit(12),
    db.select().from(galleryItems).where(eq(galleryItems.active, true)).orderBy(asc(galleryItems.sortOrder)).limit(24),
    db.select().from(faqs).where(eq(faqs.active, true)).orderBy(asc(faqs.sortOrder)),
  ]);
  return {
    testimonials: t.map((x) => ({ id: x.id, author: x.authorName, text: x.text, rating: x.rating, service: x.serviceLabel })),
    gallery: g.map((x) => ({ id: x.id, src: mediaUrl(x.mediaId)!, caption: x.caption })),
    faqs: f.map((x) => ({ id: x.id, q: x.question, a: x.answer })),
  };
}
