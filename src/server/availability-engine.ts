/**
 * Motor de disponibilidade (puro, sem acesso ao banco — fácil de testar).
 *
 * Regras:
 * - O atendimento [início, início + duração) precisa caber inteiro numa janela de trabalho
 *   (jornada do dia menos o intervalo/pausa).
 * - A ocupação na agenda é [início, início + duração + preparação). Ela não pode se
 *   sobrepor a outros agendamentos ativos, folgas, férias ou bloqueios.
 * - Horários antes de "agora + antecedência mínima" não são oferecidos.
 */
import { zonedToDate, weekdayOf } from "@/lib/time";

export type DayHours = {
  weekday: number;
  startMin: number;
  endMin: number;
  breakStartMin: number | null;
  breakEndMin: number | null;
};

export type Busy = { start: Date; end: Date };

export type SlotInput = {
  ymd: string;
  durationMin: number;
  bufferMin: number;
  hours: DayHours | undefined;
  busy: Busy[];
  stepMin: number;
  earliest: Date; // agora + antecedência mínima
};

/** Janelas de trabalho do dia em minutos, já descontando a pausa. */
export function workWindows(h: DayHours | undefined): Array<[number, number]> {
  if (!h || h.endMin <= h.startMin) return [];
  const { startMin, endMin, breakStartMin: bs, breakEndMin: be } = h;
  if (bs == null || be == null || be <= bs || be <= startMin || bs >= endMin) {
    return [[startMin, endMin]];
  }
  const out: Array<[number, number]> = [];
  if (bs > startMin) out.push([startMin, bs]);
  if (be < endMin) out.push([be, endMin]);
  return out;
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/** Retorna os minutos de início disponíveis no dia (ordenados). */
export function computeSlots(input: SlotInput): number[] {
  const { ymd, durationMin, bufferMin, hours, busy, stepMin, earliest } = input;
  if (durationMin <= 0) return [];
  const dayStart = zonedToDate(ymd, 0).getTime();
  const busyMs = busy.map((b) => [b.start.getTime(), b.end.getTime()] as const);
  const result: number[] = [];

  for (const [wStart, wEnd] of workWindows(hours)) {
    for (let m = wStart; m + durationMin <= wEnd; m += stepMin) {
      // Usa conversão por fuso para cada horário (seguro mesmo com mudanças de offset)
      const start = m === 0 ? dayStart : zonedToDate(ymd, m).getTime();
      const blockEnd = start + (durationMin + bufferMin) * 60_000;
      if (start < earliest.getTime()) continue;
      if (busyMs.some(([bs, be]) => overlaps(start, blockEnd, bs, be))) continue;
      result.push(m);
    }
  }
  return [...new Set(result)].sort((a, b) => a - b);
}

/** Verifica se um intervalo específico está livre (revalidação no servidor). */
export function isSlotFree(input: Omit<SlotInput, "stepMin"> & { startMin: number }) {
  const { ymd, durationMin, bufferMin, hours, busy, earliest, startMin } = input;
  const inWindow = workWindows(hours).some(([ws, we]) => startMin >= ws && startMin + durationMin <= we);
  if (!inWindow) return false;
  const start = zonedToDate(ymd, startMin).getTime();
  if (start < earliest.getTime()) return false;
  const blockEnd = start + (durationMin + bufferMin) * 60_000;
  return !busy.some((b) => overlaps(start, blockEnd, b.start.getTime(), b.end.getTime()));
}

export function hoursForDate(all: DayHours[], ymd: string) {
  const wd = weekdayOf(ymd);
  return all.find((h) => h.weekday === wd);
}
