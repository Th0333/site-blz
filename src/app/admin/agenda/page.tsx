import Link from "next/link";
import { and, asc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getDb } from "@/db";
import { bookings, professionals, services, timeOff, user, workingHours } from "@/db/schema";
import { expireStaleHolds } from "@/server/availability";
import { PageHeader, TabLinks } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { addDaysYmd, fmtYmdLong, isValidYmd, minutesOfDay, todayYmd, toYmd, weekdayOf, zonedToDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { AgendaToolbar } from "./toolbar";

export const metadata = { title: "Agenda" };

type View = "dia" | "semana" | "mes";
const COLORS = ["#0f6b6e", "#701a2e", "#136f73", "#8b1022", "#0a4f53", "#c45a68"];

export default async function AgendaPage({ searchParams }: PageProps<"/admin/agenda">) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const view = (["dia", "semana", "mes"].includes(get("visao")) ? get("visao") : "dia") as View;
  const date = isValidYmd(get("data")) ? get("data") : todayYmd();
  const proFilter = /^[0-9a-f-]{36}$/i.test(get("profissional")) ? get("profissional") : "";

  await expireStaleHolds();
  const db = await getDb();
  const allPros = await db.select({ id: professionals.id, name: professionals.displayName, active: professionals.active }).from(professionals).orderBy(asc(professionals.sortOrder), asc(professionals.displayName));
  const pros = proFilter ? allPros.filter((p) => p.id === proFilter) : allPros.filter((p) => p.active);
  const color = new Map(allPros.map((p, i) => [p.id, COLORS[i % COLORS.length]]));

  // Intervalo exibido
  let start = date;
  let days = 1;
  if (view === "semana") {
    start = addDaysYmd(date, -weekdayOf(date));
    days = 7;
  } else if (view === "mes") {
    const first = `${date.slice(0, 7)}-01`;
    start = addDaysYmd(first, -weekdayOf(first));
    days = 42;
  }
  const from = zonedToDate(start, 0);
  const to = zonedToDate(addDaysYmd(start, days), 0);
  const proIds = pros.map((p) => p.id);

  const rows = proIds.length
    ? await db
        .select({ b: bookings, client: user.name })
        .from(bookings)
        .innerJoin(user, eq(user.id, bookings.clientId))
        .where(and(inArray(bookings.professionalId, proIds), lt(bookings.startsAt, to), gt(bookings.endsAt, from), inArray(bookings.status, ["pending_payment", "scheduled", "confirmed", "completed", "no_show"])))
        .orderBy(asc(bookings.startsAt))
    : [];
  const offs = await db
    .select()
    .from(timeOff)
    .where(and(lt(timeOff.startsAt, to), gt(timeOff.endsAt, from), proIds.length ? or(inArray(timeOff.professionalId, proIds), isNull(timeOff.professionalId)) : isNull(timeOff.professionalId)));
  const hours = proIds.length ? await db.select().from(workingHours).where(inArray(workingHours.professionalId, proIds)) : [];
  const svcList = await db.select({ id: services.id, name: services.name, durationMin: services.durationMin }).from(services).where(eq(services.active, true)).orderBy(asc(services.name));
  const clients = await db.select({ id: user.id, name: user.name, email: user.email }).from(user).where(eq(user.role, "client")).orderBy(asc(user.name)).limit(2000);

  const nav = (delta: number) => {
    const d = view === "mes" ? (() => { const [y, m] = date.split("-").map(Number); const nm = new Date(Date.UTC(y, m - 1 + delta, 1)); return nm.toISOString().slice(0, 10); })() : addDaysYmd(date, view === "semana" ? 7 * delta : delta);
    const q = new URLSearchParams({ visao: view, data: d });
    if (proFilter) q.set("profissional", proFilter);
    return `/admin/agenda?${q}`;
  };
  const link = (patch: Record<string, string>) => {
    const q = new URLSearchParams({ visao: view, data: date, ...(proFilter ? { profissional: proFilter } : {}), ...patch });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    return `/admin/agenda?${q}`;
  };

  const title =
    view === "dia"
      ? fmtYmdLong(date)
      : view === "semana"
        ? `Semana de ${fmtYmdLong(start)}`
        : new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(zonedToDate(`${date.slice(0, 7)}-15`, 720));

  return (
    <>
      <PageHeader title="Agenda" description="Clique em um atendimento para ver detalhes, registrar pagamento ou reagendar." actions={<AgendaToolbar pros={allPros.filter((p) => p.active)} services={svcList} clients={clients} defaultDate={date} defaultPro={proFilter} openNew={get("novo") === "1"} />} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <TabLinks current={view} items={[{ key: "dia", label: "Dia", href: link({ visao: "dia" }) }, { key: "semana", label: "Semana", href: link({ visao: "semana" }) }, { key: "mes", label: "Mês", href: link({ visao: "mes" }) }]} />
        <div className="flex items-center gap-1">
          <Link href={nav(-1)} aria-label="Anterior" className={buttonVariants({ variant: "outline", size: "icon" })}><ChevronLeft className="size-4" /></Link>
          <Link href={link({ data: todayYmd() })} className={buttonVariants({ variant: "outline", size: "sm" })}>Hoje</Link>
          <Link href={nav(1)} aria-label="Próximo" className={buttonVariants({ variant: "outline", size: "icon" })}><ChevronRight className="size-4" /></Link>
        </div>
        <p className="font-display text-2xl first-letter:uppercase text-petrol">{title}</p>
        <div className="ml-auto flex flex-wrap gap-1">
          <Link href={link({ profissional: "" })} className={cn("rounded-full px-3 py-1.5 text-xs", !proFilter ? "bg-petrol text-white" : "bg-card ring-1 ring-border")}>Todas</Link>
          {allPros.filter((p) => p.active).map((p) => (
            <Link key={p.id} href={link({ profissional: p.id })} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs", proFilter === p.id ? "bg-petrol text-white" : "bg-card ring-1 ring-border")}>
              <span className="size-2 rounded-full" style={{ background: color.get(p.id) }} /> {p.name}
            </Link>
          ))}
        </div>
      </div>

      {pros.length === 0 ? (
        <p className="rounded-2xl bg-card p-10 text-center text-muted-foreground">Cadastre profissionais para visualizar a agenda.</p>
      ) : view === "mes" ? (
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card">
          <div className="grid min-w-[760px] grid-cols-7">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{d}</div>)}
            {Array.from({ length: 42 }).map((_, i) => {
              const d = addDaysYmd(start, i);
              const items = rows.filter((r) => toYmd(r.b.startsAt) === d);
              const closed = offs.some((o) => !o.professionalId && o.startsAt <= zonedToDate(d, 600) && o.endsAt >= zonedToDate(d, 1080));
              return (
                <Link key={d} href={link({ visao: "dia", data: d })} className={cn("min-h-28 border-b border-r border-border p-2 text-sm hover:bg-muted/30", d.slice(0, 7) !== date.slice(0, 7) && "bg-muted/20 text-muted-foreground", closed && "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(112,26,46,0.06)_6px,rgba(112,26,46,0.06)_12px)]")}>
                  <span className={cn("inline-grid size-7 place-items-center rounded-full text-xs", d === todayYmd() && "bg-merlot text-white")}>{Number(d.slice(8))}</span>
                  <ul className="mt-1 space-y-0.5">
                    {items.slice(0, 3).map((r) => (
                      <li key={r.b.id} className="truncate rounded px-1.5 py-0.5 text-[0.7rem] text-white" style={{ background: color.get(r.b.professionalId) }}>
                        {minutesToLabel(minutesOfDay(r.b.startsAt))} {r.client.split(" ")[0]}
                      </li>
                    ))}
                    {items.length > 3 && <li className="text-[0.7rem] text-muted-foreground">+{items.length - 3} mais</li>}
                  </ul>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <Timeline
          columns={
            view === "dia"
              ? pros.map((p) => ({ key: p.id, label: p.name, ymd: date, proIds: [p.id] }))
              : Array.from({ length: 7 }).map((_, i) => {
                  const d = addDaysYmd(start, i);
                  return { key: d, label: new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", timeZone: "America/Sao_Paulo" }).format(zonedToDate(d, 720)), ymd: d, proIds };
                })
          }
          bookings={rows.map((r) => ({ id: r.b.id, pro: r.b.professionalId, ymd: toYmd(r.b.startsAt), start: minutesOfDay(r.b.startsAt), end: minutesOfDay(r.b.startsAt) + r.b.durationMin, buffer: r.b.bufferMin, client: r.client, service: r.b.serviceName, status: r.b.status, paid: r.b.paymentStatus === "paid" }))}
          offs={offs.map((o) => ({ pro: o.professionalId, start: o.startsAt, end: o.endsAt, kind: o.kind }))}
          hours={hours}
          color={Object.fromEntries(color)}
        />
      )}
    </>
  );
}

const minutesToLabel = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function Timeline({
  columns,
  bookings: items,
  offs,
  hours,
  color,
}: {
  columns: { key: string; label: string; ymd: string; proIds: string[] }[];
  bookings: { id: string; pro: string; ymd: string; start: number; end: number; buffer: number; client: string; service: string; status: string; paid: boolean }[];
  offs: { pro: string | null; start: Date; end: Date; kind: string }[];
  hours: { professionalId: string; weekday: number; startMin: number; endMin: number; breakStartMin: number | null; breakEndMin: number | null }[];
  color: Record<string, string>;
}) {
  const allStarts = [...hours.map((h) => h.startMin), ...items.map((b) => b.start)];
  const allEnds = [...hours.map((h) => h.endMin), ...items.map((b) => b.end + b.buffer)];
  const dayStart = Math.max(0, Math.floor((allStarts.length ? Math.min(...allStarts) : 8 * 60) / 60) * 60 - 60);
  const dayEnd = Math.min(24 * 60, Math.ceil((allEnds.length ? Math.max(...allEnds) : 19 * 60) / 60) * 60 + 60);
  const PX = 1.15; // px por minuto
  const height = (dayEnd - dayStart) * PX;
  const top = (m: number) => (m - dayStart) * PX;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card">
      <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(120px, 1fr))` }}>
        <div className="border-b border-border" />
        {columns.map((c) => (
          <div key={c.key} className="border-b border-l border-border px-3 py-2.5 text-sm font-semibold capitalize text-petrol">{c.label}</div>
        ))}
        <div className="relative" style={{ height }}>
          {Array.from({ length: (dayEnd - dayStart) / 60 + 1 }).map((_, i) => (
            <span key={i} className="absolute right-2 -translate-y-1/2 text-[0.68rem] text-muted-foreground" style={{ top: i * 60 * PX }}>{minutesToLabel(dayStart + i * 60)}</span>
          ))}
        </div>
        {columns.map((c) => {
          const wd = weekdayOf(c.ymd);
          const dayZero = zonedToDate(c.ymd, 0).getTime();
          return (
            <div key={c.key} className="relative border-l border-border" style={{ height }}>
              {Array.from({ length: (dayEnd - dayStart) / 60 }).map((_, i) => <div key={i} className="absolute inset-x-0 border-t border-border/60" style={{ top: i * 60 * PX }} />)}
              {/* Fora da jornada (somente quando a coluna é de uma profissional) */}
              {c.proIds.length === 1 &&
                (() => {
                  const h = hours.find((x) => x.professionalId === c.proIds[0] && x.weekday === wd);
                  const shades: [number, number][] = h ? [[dayStart, h.startMin], [h.endMin, dayEnd], ...(h.breakStartMin != null && h.breakEndMin != null ? [[h.breakStartMin, h.breakEndMin] as [number, number]] : [])] : [[dayStart, dayEnd]];
                  return shades.filter(([a, b]) => b > a).map(([a, b], i) => <div key={i} className="absolute inset-x-0 bg-muted/60" style={{ top: top(Math.max(a, dayStart)), height: (Math.min(b, dayEnd) - Math.max(a, dayStart)) * PX }} aria-hidden />);
                })()}
              {offs
                .filter((o) => !o.pro || c.proIds.includes(o.pro))
                .map((o, i) => {
                  const a = Math.max(dayStart, Math.round((o.start.getTime() - dayZero) / 60000));
                  const b = Math.min(dayEnd, Math.round((o.end.getTime() - dayZero) / 60000));
                  if (b <= a) return null;
                  return (
                    <div key={i} className="absolute inset-x-1 rounded-md bg-[repeating-linear-gradient(135deg,rgba(112,26,46,0.10),rgba(112,26,46,0.10)_6px,transparent_6px,transparent_12px)] px-2 py-1 text-[0.68rem] font-medium text-merlot" style={{ top: top(a), height: (b - a) * PX }}>
                      {o.kind === "ferias" ? "Férias" : o.kind === "folga" ? "Folga" : o.kind === "feriado" ? "Fechado" : "Bloqueado"}
                    </div>
                  );
                })}
              {items
                .filter((b) => b.ymd === c.ymd && c.proIds.includes(b.pro))
                .map((b) => (
                  <Link
                    key={b.id}
                    href={`/admin/agendamentos/${b.id}`}
                    className={cn("absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1 text-[0.72rem] leading-tight text-white shadow-sm ring-1 ring-white/30 transition-transform hover:z-10 hover:scale-[1.02]", b.status === "pending_payment" && "opacity-70 [background-image:repeating-linear-gradient(135deg,transparent,transparent_5px,rgba(255,255,255,0.18)_5px,rgba(255,255,255,0.18)_10px)]", b.status === "no_show" && "opacity-50")}
                    style={{ top: top(b.start), height: Math.max(26, (b.end - b.start) * PX), background: color[b.pro] }}
                    title={`${b.client} — ${b.service}`}
                  >
                    <span className="font-semibold">{minutesToLabel(b.start)} {b.client.split(" ")[0]}</span>
                    <span className="block truncate opacity-90">{b.service}</span>
                    {b.paid && <span className="absolute right-1.5 top-1 rounded bg-white/25 px-1 text-[0.6rem]">pago</span>}
                    {b.buffer > 0 && <span className="absolute inset-x-0 bottom-0 h-1 bg-white/30" />}
                  </Link>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
