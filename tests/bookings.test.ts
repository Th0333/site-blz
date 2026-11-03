import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { bookings, financialEntries, services, timeOff } from "@/db/schema";
import { createBooking, cancelBooking, rescheduleBooking, getBookingForUser } from "@/server/bookings";
import { getDaySlots, getAvailableDates } from "@/server/availability";
import { getSettings } from "@/server/settings";
import { registerInPersonPayment } from "@/server/payments";
import { addDaysYmd, todayYmd, zonedToDate } from "@/lib/time";
import { freshDb, makePro, makeService, makeUser } from "./helpers";

const ymd = "2030-03-05";
const NOW = new Date("2030-03-01T12:00:00Z");
let db: DB;

beforeEach(async () => {
  db = await freshDb({ maxDaysAhead: 30 });
});

describe("agendamento", () => {
  it("calendário e horários respeitam jornada e bloqueios", async () => {
    const pro = await makePro(db);
    const svc = await makeService(db, [pro.id]);
    const settings = await getSettings();
    let slots = await getDaySlots({ serviceId: svc.id, professionalId: pro.id, ymd, settings, now: NOW });
    expect(slots.map((s) => s.label)).toContain("09:00");
    await db.insert(timeOff).values({ professionalId: pro.id, kind: "folga", startsAt: zonedToDate(ymd, 0), endsAt: zonedToDate("2030-03-06", 0) });
    slots = await getDaySlots({ serviceId: svc.id, professionalId: pro.id, ymd, settings, now: NOW });
    expect(slots).toEqual([]);
    const dates = await getAvailableDates({ serviceId: svc.id, professionalId: pro.id, fromYmd: "2030-03-04", toYmd: "2030-03-06", settings, now: NOW });
    expect(dates).toEqual(["2030-03-04", "2030-03-06"]);
    // datas passadas e além do limite configurado
    expect(await getAvailableDates({ serviceId: svc.id, professionalId: pro.id, fromYmd: "2030-02-20", toYmd: "2030-02-28", settings, now: NOW })).toEqual([]);
    expect(await getDaySlots({ serviceId: svc.id, professionalId: pro.id, ymd: "2030-05-01", settings, now: NOW })).toEqual([]);
  });

  it("dois clientes não conseguem reservar o mesmo horário (concorrência)", async () => {
    const pro = await makePro(db);
    const svc = await makeService(db, [pro.id]);
    const clients = await Promise.all([1, 2, 3, 4, 5].map(() => makeUser(db)));
    const results = await Promise.allSettled(
      clients.map((clientId) => createBooking({ clientId, serviceId: svc.id, professionalId: pro.id, ymd, startMin: 600, paymentMethod: "in_person", now: NOW })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    // horário parcialmente sobreposto também é recusado
    await expect(
      createBooking({ clientId: clients[0], serviceId: svc.id, professionalId: pro.id, ymd, startMin: 630, paymentMethod: "in_person", now: NOW }),
    ).rejects.toThrow(/indisponível/);
    expect(await db.select().from(bookings)).toHaveLength(1);
  });

  it("a constraint do banco barra sobreposição mesmo sem a checagem da aplicação", async () => {
    const pro = await makePro(db);
    const client = await makeUser(db);
    const row = (h: number) => ({
      code: `T-${h}`,
      clientId: client,
      professionalId: pro.id,
      serviceName: "x",
      priceCents: 1000,
      durationMin: 60,
      startsAt: zonedToDate(ymd, h * 60),
      endsAt: zonedToDate(ymd, h * 60 + 60),
      blockEndsAt: zonedToDate(ymd, h * 60 + 60),
      paymentMethod: "in_person" as const,
    });
    await db.insert(bookings).values(row(10));
    await expect(db.insert(bookings).values({ ...row(10), code: "T-dup" })).rejects.toThrow();
    await db.insert(bookings).values(row(11)); // encostado (intervalo semiaberto) é permitido
  });

  it("qualquer profissional: usa outra quando a primeira está ocupada", async () => {
    const ana = await makePro(db, "Ana");
    const bia = await makePro(db, "Bia");
    const svc = await makeService(db, [ana.id, bia.id]);
    const [c1, c2, c3] = [await makeUser(db), await makeUser(db), await makeUser(db)];
    const b1 = await createBooking({ clientId: c1, serviceId: svc.id, professionalId: "any", ymd, startMin: 600, paymentMethod: "in_person", now: NOW });
    const b2 = await createBooking({ clientId: c2, serviceId: svc.id, professionalId: "any", ymd, startMin: 600, paymentMethod: "in_person", now: NOW });
    expect(new Set([b1.professionalId, b2.professionalId]).size).toBe(2);
    await expect(
      createBooking({ clientId: c3, serviceId: svc.id, professionalId: "any", ymd, startMin: 600, paymentMethod: "in_person", now: NOW }),
    ).rejects.toThrow();
  });

  it("pagamento no dia fica pendente e não vira receita até o registro manual", async () => {
    const pro = await makePro(db);
    const svc = await makeService(db, [pro.id], { priceCents: 18000 });
    const client = await makeUser(db);
    const admin = await makeUser(db, "admin");
    const b = await createBooking({ clientId: client, serviceId: svc.id, professionalId: pro.id, ymd, startMin: 540, paymentMethod: "in_person", now: NOW });
    expect(b.status).toBe("scheduled");
    expect(b.paymentStatus).toBe("pending");
    expect(await db.select().from(financialEntries)).toHaveLength(0);

    await registerInPersonPayment({ bookingId: b.id, amountCents: 18000, method: "pix", paidAt: new Date(), actorId: admin });
    const entries = await db.select().from(financialEntries);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ amountCents: 18000, channel: "in_person", createdBy: admin });
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after.paymentStatus).toBe("paid");
    // registro duplicado é bloqueado
    await expect(
      registerInPersonPayment({ bookingId: b.id, amountCents: 18000, method: "cash", paidAt: new Date(), actorId: admin }),
    ).rejects.toThrow(/já possui/);
    expect(await db.select().from(financialEntries)).toHaveLength(1);
  });

  it("preço e descrição ficam congelados no agendamento", async () => {
    const pro = await makePro(db);
    const svc = await makeService(db, [pro.id], { priceCents: 20000 });
    const b = await createBooking({ clientId: await makeUser(db), serviceId: svc.id, professionalId: pro.id, ymd, startMin: 540, paymentMethod: "in_person", now: NOW });
    await db.update(services).set({ priceCents: 99900, name: "Novo nome" }).where(eq(services.id, svc.id));
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after.priceCents).toBe(20000);
    expect(after.serviceName).toBe("Maquiagem social");
  });

  it("reserva online expirada libera o horário", async () => {
    const pro = await makePro(db);
    const svc = await makeService(db, [pro.id]);
    const past = new Date(Date.now() - 2 * 3600_000);
    const day = addDaysYmd(todayYmd(), 3);
    const b = await createBooking({ clientId: await makeUser(db), serviceId: svc.id, professionalId: pro.id, ymd: day, startMin: 540, paymentMethod: "online", now: past });
    expect(b.status).toBe("pending_payment");
    const again = await createBooking({ clientId: await makeUser(db), serviceId: svc.id, professionalId: pro.id, ymd: day, startMin: 540, paymentMethod: "in_person" });
    expect(again.status).toBe("scheduled");
    const [old] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(old.status).toBe("expired");
  });

  it("cliente não acessa nem cancela agendamento de outra pessoa", async () => {
    const pro = await makePro(db);
    const svc = await makeService(db, [pro.id]);
    const owner = await makeUser(db);
    const intruder = await makeUser(db);
    const b = await createBooking({ clientId: owner, serviceId: svc.id, professionalId: pro.id, ymd, startMin: 540, paymentMethod: "in_person", now: NOW });
    expect(await getBookingForUser(b.id, intruder)).toBeNull();
    expect(await getBookingForUser(b.id, owner)).not.toBeNull();
    await expect(cancelBooking({ bookingId: b.id, actor: { id: intruder, isAdmin: false }, now: NOW })).rejects.toThrow(/não encontrado/);
    await expect(
      rescheduleBooking({ bookingId: b.id, ymd, startMin: 600, actor: { id: intruder, isAdmin: false }, now: NOW }),
    ).rejects.toThrow(/não encontrado/);
  });

  it("política de cancelamento e reagendamento com revalidação", async () => {
    const pro = await makePro(db);
    const svc = await makeService(db, [pro.id]);
    const c = await makeUser(db);
    const b = await createBooking({ clientId: c, serviceId: svc.id, professionalId: pro.id, ymd, startMin: 540, paymentMethod: "in_person", now: NOW });
    const other = await createBooking({ clientId: await makeUser(db), serviceId: svc.id, professionalId: pro.id, ymd, startMin: 660, paymentMethod: "in_person", now: NOW });
    await expect(
      rescheduleBooking({ bookingId: b.id, ymd, startMin: 660, actor: { id: c, isAdmin: false }, now: NOW }),
    ).rejects.toThrow(/disponível/);
    const moved = await rescheduleBooking({ bookingId: b.id, ymd, startMin: 600, actor: { id: c, isAdmin: false }, now: NOW });
    expect(moved.startsAt.toISOString()).toBe("2030-03-05T13:00:00.000Z");
    // menos de 24h antes: bloqueado para a cliente
    const late = new Date("2030-03-05T10:00:00Z");
    await expect(cancelBooking({ bookingId: b.id, actor: { id: c, isAdmin: false }, now: late })).rejects.toThrow(/24h/);
    const cancelled = await cancelBooking({ bookingId: other.id, actor: { id: c, isAdmin: true }, now: late, reason: "teste" });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.paymentStatus).toBe("not_charged");
  });
});
