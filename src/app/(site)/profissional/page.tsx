import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, professionals, user } from "@/db/schema";
import { getSessionUser } from "@/server/session";
import { StatusBadge } from "@/components/status-badge";
import { BOOKING_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/labels";
import { fmtDate, fmtDuration, fmtTime, fmtWeekday, todayYmd, zonedToDate } from "@/lib/time";

export const metadata: Metadata = { title: "Minha agenda", robots: { index: false } };

/** Perfil "profissional": vê apenas a própria agenda e os compromissos autorizados. */
export default async function ProfessionalAgenda() {
  const u = await getSessionUser();
  if (!u) redirect("/entrar?next=/profissional");
  if (u.role !== "professional" && u.role !== "admin") redirect("/minha-conta");
  const db = await getDb();
  const [pro] = await db.select().from(professionals).where(eq(professionals.userId, u.id));
  if (!pro) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-36 text-center">
        <h1 className="display text-5xl text-petrol">Minha agenda</h1>
        <p className="mt-4 text-muted-foreground">Sua conta ainda não foi vinculada a um perfil de profissional. Peça à administração do estúdio para vincular seu e-mail.</p>
      </div>
    );
  }
  const list = await db
    .select({ b: bookings, client: user.name, phone: user.phone })
    .from(bookings)
    .innerJoin(user, eq(user.id, bookings.clientId))
    .where(and(eq(bookings.professionalId, pro.id), gte(bookings.startsAt, zonedToDate(todayYmd(), 0)), inArray(bookings.status, ["pending_payment", "scheduled", "confirmed", "completed", "no_show"])))
    .orderBy(asc(bookings.startsAt))
    .limit(200);

  const groups = new Map<string, typeof list>();
  for (const r of list) {
    const k = fmtDate(r.b.startsAt);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  return (
    <div className="bg-paper pb-24 pt-28 sm:pt-36">
      <div className="mx-auto max-w-[920px] px-4 sm:px-6">
        <p className="eyebrow text-teal">Área da profissional</p>
        <h1 className="display mt-3 text-[clamp(2.5rem,6vw,4.2rem)] text-petrol">Agenda de <span className="italic text-merlot">{pro.displayName}</span></h1>
        {list.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">Nenhum atendimento a partir de hoje.</p>
        ) : (
          <div className="mt-10 space-y-10">
            {[...groups.entries()].map(([day, rows]) => (
              <section key={day}>
                <h2 className="font-display text-2xl text-petrol">{fmtWeekday(rows[0].b.startsAt)}, {day}</h2>
                <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
                  {rows.map(({ b, client, phone }) => (
                    <li key={b.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
                      <span className="w-16 font-display text-2xl text-merlot">{fmtTime(b.startsAt)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{client}</span>
                        <span className="text-sm text-muted-foreground">{b.serviceName} · {fmtDuration(b.durationMin)}{phone ? ` · ${phone}` : ""}</span>
                        {b.clientNotes && <span className="mt-1 block text-sm italic text-muted-foreground">“{b.clientNotes}”</span>}
                      </span>
                      <StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} />
                      <StatusBadge status={b.paymentStatus} label={PAYMENT_STATUS_LABEL[b.paymentStatus]} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
