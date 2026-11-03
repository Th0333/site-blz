import { asc, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { faqs, galleryItems, testimonials } from "@/db/schema";
import { PageHeader, Card } from "@/components/admin/ui";
import { mediaUrl } from "@/lib/media-url";
import { fmtDate } from "@/lib/time";
import { GalleryManager, TestimonialsManager, FaqManager } from "./parts";

export const metadata = { title: "Galeria e conteúdo" };

export default async function ContentAdmin() {
  const db = await getDb();
  const [g, t, f] = await Promise.all([
    db.select().from(galleryItems).orderBy(asc(galleryItems.sortOrder), desc(galleryItems.createdAt)),
    db.select().from(testimonials).orderBy(asc(testimonials.approved), desc(testimonials.createdAt)),
    db.select().from(faqs).orderBy(asc(faqs.sortOrder)),
  ]);
  return (
    <>
      <PageHeader title="Galeria e conteúdo" description="Tudo o que aparece no site é editado aqui ou em Configurações do estúdio." />
      <div className="space-y-6">
        <Card title="Galeria de trabalhos">
          <GalleryManager items={g.map((x) => ({ id: x.id, src: mediaUrl(x.mediaId)!, caption: x.caption ?? "", active: x.active, sortOrder: x.sortOrder, demo: x.isDemo }))} />
        </Card>
        <Card title="Depoimentos">
          <TestimonialsManager items={t.map((x) => ({ id: x.id, author: x.authorName, text: x.text, rating: x.rating, service: x.serviceLabel, approved: x.approved, fromClient: !!x.authorUserId, date: fmtDate(x.createdAt), demo: x.isDemo }))} />
        </Card>
        <Card title="Perguntas frequentes">
          <FaqManager items={f.map((x) => ({ id: x.id, question: x.question, answer: x.answer, sortOrder: x.sortOrder, active: x.active, demo: x.isDemo }))} />
        </Card>
      </div>
    </>
  );
}
