import { openPglite, setDbForTests, type DB } from "@/db";
import { professionals, serviceProfessionals, services, studioSettings, user, workingHours } from "@/db/schema";
import { settingsSchema, type StudioSettings } from "@/lib/settings-schema";

export async function freshDb(settings: Partial<StudioSettings> = {}) {
  const db = await openPglite(); // em memória
  setDbForTests(db);
  await db.insert(studioSettings).values({
    id: 1,
    data: settingsSchema.parse({ onlinePaymentEnabled: true, inPersonPaymentEnabled: true, minNoticeHours: 0, ...settings }),
  });
  return db;
}

let n = 0;
export async function makeUser(db: DB, role = "client") {
  const id = `u${++n}-${Math.random().toString(36).slice(2, 8)}`;
  await db.insert(user).values({ id, name: `Cliente ${n}`, email: `${id}@teste.dev`, role });
  return id;
}

/** Profissional com jornada 09:00–18:00 (pausa 12:00–13:00) todos os dias. */
export async function makePro(db: DB, name = "Ana") {
  const [p] = await db
    .insert(professionals)
    .values({ fullName: name, displayName: name, slug: `${name.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}` })
    .returning();
  await db.insert(workingHours).values(
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ professionalId: p.id, weekday, startMin: 540, endMin: 1080, breakStartMin: 720, breakEndMin: 780 })),
  );
  return p;
}

export async function makeService(db: DB, proIds: string[], o: { durationMin?: number; bufferMin?: number; priceCents?: number } = {}) {
  const [s] = await db
    .insert(services)
    .values({
      name: "Maquiagem social",
      slug: `maq-${Math.random().toString(36).slice(2, 7)}`,
      priceCents: o.priceCents ?? 25000,
      durationMin: o.durationMin ?? 60,
      bufferMin: o.bufferMin ?? 0,
    })
    .returning();
  if (proIds.length) await db.insert(serviceProfessionals).values(proIds.map((professionalId) => ({ serviceId: s.id, professionalId })));
  return s;
}
