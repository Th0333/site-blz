/**
 * Dados de DEMONSTRAÇÃO — sempre marcados com is_demo = true e exibidos com aviso no site.
 * Servem para visualizar a experiência antes de cadastrar os dados reais do estúdio.
 * A administradora remove tudo com um clique em Configurações.
 */
import { cache } from "react";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, faqs, galleryItems, media, professionals, serviceProfessionals, services, testimonials, workingHours } from "@/db/schema";
import { getSettings, saveSettings } from "./settings";

const U = (id: string, w = 1400) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const hasDemoData = cache(async function hasDemoData() {
  const db = await getDb();
  const res = (await db.execute(sql`
    select (select count(*) from services where is_demo) + (select count(*) from professionals where is_demo)
         + (select count(*) from testimonials where is_demo) + (select count(*) from gallery_items where is_demo)
         + (select count(*) from faqs where is_demo) as n`)) as unknown as { rows?: Array<{ n: number }> } | Array<{ n: number }>;
  const r = Array.isArray(res) ? res[0] : res.rows?.[0];
  return Number(r?.n ?? 0) > 0;
});

export async function seedDemo(actorId: string | null) {
  const db = await getDb();
  if (await hasDemoData()) return { created: false };

  const img = async (id: string, alt: string, w?: number) => {
    const [m] = await db.insert(media).values({ mime: "image/jpeg", url: U(id, w), alt, isDemo: true, createdBy: actorId }).returning({ id: media.id });
    return m.id;
  };

  const pros = await db
    .insert(professionals)
    .values([
      { fullName: "Helena Duarte (demonstração)", displayName: "Helena", slug: "demo-helena", specialties: ["Noivas", "Pele glow"], bio: "Perfil de demonstração. Substitua pela biografia real da profissional no painel.", photoId: await img("1611451444023-7fe9d86fe1d0", "Retrato de demonstração", 900), sortOrder: 1, isDemo: true },
      { fullName: "Marina Toledo (demonstração)", displayName: "Marina", slug: "demo-marina", specialties: ["Eventos", "Penteados"], bio: "Perfil de demonstração. Substitua pela biografia real da profissional no painel.", photoId: await img("1601117830731-1a36c879f666", "Retrato de demonstração", 900), sortOrder: 2, isDemo: true },
      { fullName: "Lívia Brandão (demonstração)", displayName: "Lívia", slug: "demo-livia", specialties: ["Sobrancelhas", "Maquiagem social"], bio: "Perfil de demonstração. Substitua pela biografia real da profissional no painel.", photoId: await img("1557555187-23d685287bc3", "Retrato de demonstração", 900), sortOrder: 3, isDemo: true },
    ])
    .returning();

  // Jornada de demonstração: terça a sábado, 9h–19h com pausa 13h–14h
  await db.insert(workingHours).values(
    pros.flatMap((p) => [2, 3, 4, 5, 6].map((weekday) => ({ professionalId: p.id, weekday, startMin: 9 * 60, endMin: 19 * 60, breakStartMin: 13 * 60, breakEndMin: 14 * 60 }))),
  );

  const svcData = [
    { name: "Maquiagem social", category: "Maquiagem", description: "Pele iluminada e acabamento leve para jantares, aniversários e encontros.", priceCents: 22000, durationMin: 60, bufferMin: 15, featured: true, photo: "1709477542149-f4e0e21d590b", pros: [0, 1, 2] },
    { name: "Maquiagem para eventos", category: "Maquiagem", description: "Produção de longa duração para formaturas, festas e fotos com flash.", priceCents: 32000, durationMin: 90, bufferMin: 15, featured: true, photo: "1773688189414-7637b9b138e1", pros: [0, 1] },
    { name: "Maquiagem para noivas", category: "Noivas", description: "Atendimento exclusivo no dia do casamento, com preparação de pele completa.", priceCents: 95000, priceFrom: true, durationMin: 150, bufferMin: 30, featured: true, photo: "1600685890506-593fdf55949b", pros: [0] },
    { name: "Penteado", category: "Cabelo", description: "Penteados preso, semipreso ou ondas, finalizados para durar a noite toda.", priceCents: 18000, priceFrom: true, durationMin: 60, bufferMin: 10, featured: false, photo: "1774660810725-fb04e002003d", pros: [1] },
    { name: "Design de sobrancelhas", category: "Sobrancelhas", description: "Mapeamento facial e design personalizado, respeitando o desenho natural.", priceCents: 7000, durationMin: 40, bufferMin: 10, featured: false, photo: "1728463087277-97c8d8c7b6a4", pros: [2] },
  ];
  let order = 0;
  for (const s of svcData) {
    const [row] = await db
      .insert(services)
      .values({ name: s.name, slug: `demo-${s.name.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").replace(/\s+/g, "-")}`, category: s.category, description: s.description, priceCents: s.priceCents, priceFrom: !!s.priceFrom, durationMin: s.durationMin, bufferMin: s.bufferMin, featured: s.featured, sortOrder: order++, photoId: await img(s.photo, s.name), isDemo: true })
      .returning();
    await db.insert(serviceProfessionals).values(s.pros.map((i) => ({ serviceId: row.id, professionalId: pros[i].id })));
  }

  const gallery = ["1440589473619-3cde28941638", "1596462502278-27bfdc403348", "1669846691725-005aac248ef4", "1709477542170-f11ee7d471a0", "1764333746348-1df13b3a4aae", "1610173827043-9db50e0d8ef9"];
  let gi = 0;
  for (const g of gallery) {
    await db.insert(galleryItems).values({ mediaId: await img(g, "Imagem de demonstração", 800), caption: "Imagem de demonstração", sortOrder: gi++, isDemo: true });
  }

  await db.insert(testimonials).values([
    { authorName: "Depoimento de demonstração", text: "Este é um texto de exemplo. Os depoimentos reais aparecem aqui depois de aprovados pela administradora.", serviceLabel: "Exemplo", approved: true, isDemo: true, sortOrder: 0 },
    { authorName: "Depoimento de demonstração", text: "Clientes podem enviar depoimentos pela área Minha conta após o atendimento. Nada é publicado sem aprovação.", serviceLabel: "Exemplo", approved: true, isDemo: true, sortOrder: 1 },
  ]);

  await db.insert(faqs).values([
    { question: "Preciso chegar com o rosto limpo?", answer: "Resposta de demonstração — edite no painel em Galeria e conteúdo.", sortOrder: 0, isDemo: true },
    { question: "Posso remarcar meu horário?", answer: "Sim, pela área Minha conta, respeitando a antecedência mínima configurada pelo estúdio.", sortOrder: 1, isDemo: true },
    { question: "Quais formas de pagamento são aceitas?", answer: "Você pode pagar online com Mercado Pago (cartão, Pix e outros meios habilitados) ou no dia do atendimento, quando disponível.", sortOrder: 2, isDemo: true },
  ]);

  const s = await getSettings();
  if (!s.heroImageId) {
    await saveSettings(
      {
        heroImageId: await img("1594465919760-441fe5908ab0", "Imagem de demonstração", 1600),
        heroSecondaryImageId: await img("1512496015851-a90fb38ba796", "Imagem de demonstração", 700),
        aboutImageId: await img("1551723454-7565a1f5b161", "Imagem de demonstração", 1000),
        aboutText: s.aboutText || "Texto de demonstração. Conte aqui a história do estúdio, a forma de atender e o que torna a experiência única.\n\nEdite este conteúdo em Configurações do estúdio.",
        highlights: s.highlights.length ? s.highlights : [
          { title: "Pele em primeiro lugar", text: "Exemplo de destaque — edite no painel." },
          { title: "Tempo de verdade", text: "Exemplo de destaque — edite no painel." },
        ],
        openingHours: s.openingHours.length ? s.openingHours : [{ label: "Terça a sábado", hours: "9h às 19h" }],
      },
      actorId,
    );
  }
  return { created: true };
}

/** Remove todo o conteúdo de demonstração. Profissionais/serviços demo com agendamentos são apenas desativados. */
export async function removeDemoData() {
  const db = await getDb();
  const demoPros = await db.select({ id: professionals.id }).from(professionals).where(eq(professionals.isDemo, true));
  const demoSvcs = await db.select({ id: services.id }).from(services).where(eq(services.isDemo, true));
  const proIds = demoPros.map((p) => p.id);
  const svcIds = demoSvcs.map((s) => s.id);
  const usedPros = proIds.length ? await db.selectDistinct({ id: bookings.professionalId }).from(bookings).where(inArray(bookings.professionalId, proIds)) : [];
  const used = new Set(usedPros.map((u) => u.id));

  await db.delete(testimonials).where(eq(testimonials.isDemo, true));
  await db.delete(galleryItems).where(eq(galleryItems.isDemo, true));
  await db.delete(faqs).where(eq(faqs.isDemo, true));
  if (svcIds.length) await db.delete(services).where(inArray(services.id, svcIds)); // agendamentos guardam snapshot; service_id vira nulo
  for (const id of proIds) {
    if (used.has(id)) await db.update(professionals).set({ active: false }).where(eq(professionals.id, id));
    else await db.delete(professionals).where(eq(professionals.id, id));
  }
  const s = await getSettings();
  const demoMedia = await db.select({ id: media.id }).from(media).where(eq(media.isDemo, true));
  const demoIds = new Set(demoMedia.map((m) => m.id));
  const patch: Record<string, null> = {};
  for (const k of ["heroImageId", "heroSecondaryImageId", "aboutImageId", "logoId", "logoLightId"] as const) if (s[k] && demoIds.has(s[k]!)) patch[k] = null;
  if (Object.keys(patch).length) await saveSettings(patch, null);
  await db.delete(media).where(and(eq(media.isDemo, true), sql`not exists (select 1 from professionals p where p.photo_id = media.id)`));
}
