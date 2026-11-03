/**
 * Utilitários de data/hora no fuso do estúdio (America/Sao_Paulo).
 * Datas "de calendário" trafegam como strings YYYY-MM-DD; horários como minutos desde 00:00.
 */
export const TZ = "America/Sao_Paulo";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function zonedParts(date: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WEEKDAYS.indexOf(p.weekday as string),
  };
}

/** Diferença (ms) entre o relógio local do fuso e UTC naquele instante. */
function offsetMs(date: Date) {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Converte data local (YYYY-MM-DD) + minutos no fuso do estúdio para um instante UTC. */
export function zonedToDate(ymd: string, minutes = 0): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let result = guess - offsetMs(new Date(guess));
  // Reaplica para cobrir mudanças de offset (horário de verão histórico)
  result = guess - offsetMs(new Date(result));
  return new Date(result);
}

export function toYmd(date: Date): string {
  const p = zonedParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function minutesOfDay(date: Date): number {
  const p = zonedParts(date);
  return p.hour * 60 + p.minute;
}

export function weekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function todayYmd(now = new Date()) {
  return toYmd(now);
}

export function isValidYmd(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function hhmm(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function parseHhmm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "long" });
const dateShortFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });

export const fmtDate = (d: Date) => dateFmt.format(d);
export const fmtDateShort = (d: Date) => dateShortFmt.format(d);
export const fmtTime = (d: Date) => timeFmt.format(d);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const fmtWeekday = (d: Date) => cap(weekdayFmt.format(d));
export const fmtDateTime = (d: Date) => dateTimeFmt.format(d);

export function fmtYmdLong(ymd: string) {
  return cap(new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(zonedToDate(ymd, 12 * 60)));
}

export function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}
