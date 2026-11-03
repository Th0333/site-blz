"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, professionals, serviceProfessionals, timeOff, user, workingHours } from "@/db/schema";
import { requireAdmin } from "@/server/session";
import { imageFromForm } from "@/server/media";
import { BusinessError, toResult } from "@/server/errors";
import { audit } from "@/server/events";
import { slugify } from "@/lib/slug";
import { isValidYmd, parseHhmm, zonedToDate } from "@/lib/time";

const schema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo.").max(120),
  displayName: z.string().trim().min(2).max(40),
  bio: z.string().trim().max(1200),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export async function saveProfessionalAction(id: string | null, form: FormData) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const data = schema.parse({ fullName: form.get("fullName"), displayName: form.get("displayName"), bio: form.get("bio") ?? "", sortOrder: form.get("sortOrder") || 0 });
    const specialties = String(form.get("specialties") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8);
    const serviceIds = form.getAll("services").map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
    const accountEmail = String(form.get("accountEmail") ?? "").trim().toLowerCase();
    const photoId = await imageFromForm(form, "photo", admin.id, data.displayName);
    const db = await getDb();

    let linkedUserId: string | null = null;
    if (accountEmail) {
      const [u] = await db.select().from(user).where(eq(user.email, accountEmail));
      if (!u) throw new BusinessError("Não há conta com esse e-mail. Peça para a profissional criar a conta no site primeiro.");
      if (u.role === "admin") linkedUserId = u.id;
      else {
        linkedUserId = u.id;
        await db.update(user).set({ role: "professional" }).where(eq(user.id, u.id));
      }
    }

    const savedId = await db.transaction(async (tx) => {
      if (linkedUserId) {
        const [other] = await tx.select({ id: professionals.id }).from(professionals).where(and(eq(professionals.userId, linkedUserId), id ? ne(professionals.id, id) : undefined));
        if (other) throw new BusinessError("Essa conta já está vinculada a outra profissional.");
      }
      let slug = slugify(data.displayName);
      const clash = await tx.select({ id: professionals.id }).from(professionals).where(and(eq(professionals.slug, slug), id ? ne(professionals.id, id) : undefined));
      if (clash.length) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const values = {
        ...data,
        slug,
        specialties,
        active: form.get("active") === "on",
        userId: linkedUserId,
        updatedAt: new Date(),
        ...(photoId ? { photoId } : form.get("remove_photo") === "1" ? { photoId: null } : {}),
      };
      let pid = id;
      if (id) {
        const [u] = await tx.update(professionals).set(values).where(eq(professionals.id, id)).returning({ id: professionals.id });
        if (!u) throw new BusinessError("Profissional não encontrada.");
      } else {
        const [c] = await tx.insert(professionals).values(values).returning({ id: professionals.id });
        pid = c.id;
      }
      await tx.delete(serviceProfessionals).where(eq(serviceProfessionals.professionalId, pid!));
      if (serviceIds.length) await tx.insert(serviceProfessionals).values(serviceIds.map((serviceId) => ({ serviceId, professionalId: pid! })));
      await audit(admin.id, id ? "professional.update" : "professional.create", "professional", pid, { displayName: data.displayName, active: values.active }, tx);
      return pid!;
    });
    revalidatePath("/", "layout");
    return { id: savedId };
  });
}

const dayRow = z.object({
  weekday: z.number().int().min(0).max(6),
  enabled: z.boolean(),
  start: z.string(),
  end: z.string(),
  breakStart: z.string().optional(),
  breakEnd: z.string().optional(),
});

export async function saveHoursAction(professionalId: string, days: z.infer<typeof dayRow>[]) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const rows = z.array(dayRow).parse(days);
    const values: (typeof workingHours.$inferInsert)[] = [];
    for (const d of rows) {
      if (!d.enabled) continue;
      const s = parseHhmm(d.start);
      const e = parseHhmm(d.end);
      if (s === null || e === null || e <= s) throw new BusinessError("Confira os horários: o fim do expediente precisa ser depois do início.");
      const bs = d.breakStart ? parseHhmm(d.breakStart) : null;
      const be = d.breakEnd ? parseHhmm(d.breakEnd) : null;
      if ((bs === null) !== (be === null) || (bs !== null && be !== null && (be <= bs || bs < s || be > e)))
        throw new BusinessError("O intervalo precisa ter início e fim dentro do expediente.");
      values.push({ professionalId, weekday: d.weekday, startMin: s, endMin: e, breakStartMin: bs, breakEndMin: be });
    }
    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx.delete(workingHours).where(eq(workingHours.professionalId, professionalId));
      if (values.length) await tx.insert(workingHours).values(values);
      await audit(admin.id, "professional.hours", "professional", professionalId, { days: values.length }, tx);
    });
    revalidatePath(`/admin/profissionais/${professionalId}`);
  });
}

const offSchema = z.object({
  professionalId: z.string().uuid().nullable(),
  kind: z.enum(["folga", "ferias", "bloqueio", "feriado"]),
  startDate: z.string(),
  startTime: z.string().optional(),
  endDate: z.string(),
  endTime: z.string().optional(),
  reason: z.string().max(200).optional(),
});

/** Folgas, férias e bloqueios (dia inteiro ou faixa de horário). professionalId nulo = estúdio fechado. */
export async function addTimeOffAction(input: z.infer<typeof offSchema>) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const d = offSchema.parse(input);
    if (!isValidYmd(d.startDate) || !isValidYmd(d.endDate)) throw new BusinessError("Datas inválidas.");
    const sm = d.startTime ? parseHhmm(d.startTime) : 0;
    const em = d.endTime ? parseHhmm(d.endTime) : 24 * 60;
    if (sm === null || em === null) throw new BusinessError("Horário inválido.");
    const startsAt = zonedToDate(d.startDate, sm);
    const endsAt = zonedToDate(d.endDate, em);
    if (endsAt <= startsAt) throw new BusinessError("O fim precisa ser depois do início.");
    const db = await getDb();
    const [row] = await db.insert(timeOff).values({ professionalId: d.professionalId, kind: d.kind, startsAt, endsAt, reason: d.reason || null, createdBy: admin.id }).returning();
    // Avisa (não cancela) se já existem agendamentos no período bloqueado
    const conflicts = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(d.professionalId ? eq(bookings.professionalId, d.professionalId) : undefined, inArray(bookings.status, ["pending_payment", "scheduled", "confirmed"]), gt(bookings.blockEndsAt, startsAt), lt(bookings.startsAt, endsAt)));
    await audit(admin.id, "timeoff.create", "time_off", row.id, { kind: d.kind });
    revalidatePath("/admin", "layout");
    return { conflicts: conflicts.length };
  });
}

export async function deleteTimeOffAction(id: string) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    await db.delete(timeOff).where(eq(timeOff.id, z.string().uuid().parse(id)));
    await audit(admin.id, "timeoff.delete", "time_off", id);
    revalidatePath("/admin", "layout");
  });
}

export async function setProfessionalActiveAction(id: string, active: boolean) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const db = await getDb();
    await db.update(professionals).set({ active, updatedAt: new Date() }).where(eq(professionals.id, z.string().uuid().parse(id)));
    const future = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.professionalId, id), gt(bookings.startsAt, new Date()), inArray(bookings.status, ["pending_payment", "scheduled", "confirmed"])));
    await audit(admin.id, active ? "professional.activate" : "professional.deactivate", "professional", id, { futureBookings: future.length });
    revalidatePath("/", "layout");
    return { futureBookings: future.length };
  });
}
