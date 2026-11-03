import { describe, expect, it } from "vitest";
import { computeSlots, isSlotFree, workWindows } from "@/server/availability-engine";
import { zonedToDate, toYmd, minutesOfDay, addDaysYmd, weekdayOf } from "@/lib/time";

const hours = { weekday: 2, startMin: 540, endMin: 1080, breakStartMin: 720, breakEndMin: 780 };
const ymd = "2030-03-05";
const at = (h: number, m = 0) => zonedToDate(ymd, h * 60 + m);

describe("fuso America/Sao_Paulo", () => {
  it("converte data local para UTC (-03:00)", () => {
    expect(zonedToDate(ymd, 9 * 60).toISOString()).toBe("2030-03-05T12:00:00.000Z");
    expect(toYmd(new Date("2030-03-06T02:30:00Z"))).toBe("2030-03-05");
    expect(minutesOfDay(new Date("2030-03-05T12:30:00Z"))).toBe(570);
    expect(addDaysYmd("2030-12-31", 1)).toBe("2031-01-01");
    expect(weekdayOf("2030-03-05")).toBe(2);
  });
});

describe("motor de disponibilidade", () => {
  const base = { ymd, durationMin: 60, bufferMin: 0, hours, busy: [], stepMin: 30, earliest: new Date(0) };

  it("desconta a pausa da jornada", () => {
    expect(workWindows(hours)).toEqual([[540, 720], [780, 1080]]);
  });

  it("gera horários dentro da jornada sem invadir a pausa", () => {
    const slots = computeSlots(base);
    expect(slots[0]).toBe(540);
    expect(slots).toContain(660); // 11:00-12:00 cabe
    expect(slots).not.toContain(690); // 11:30-12:30 invade a pausa
    expect(slots).not.toContain(720);
    expect(slots).toContain(780);
    expect(slots.at(-1)).toBe(1020); // 17:00-18:00
  });

  it("sem jornada no dia não há horários", () => {
    expect(computeSlots({ ...base, hours: undefined })).toEqual([]);
  });

  it("respeita agendamentos existentes e o tempo de preparação", () => {
    const busy = [{ start: at(10), end: at(11) }];
    const slots = computeSlots({ ...base, busy, bufferMin: 30 });
    expect(slots).not.toContain(540); // 9:00-10:00 + 30min preparo invade 10:00
    expect(slots).not.toContain(600);
    expect(slots).toContain(660);
  });

  it("respeita folgas/bloqueios e antecedência mínima", () => {
    const busy = [{ start: at(13), end: at(15) }];
    const slots = computeSlots({ ...base, busy, earliest: at(10, 15) });
    expect(slots.some((m) => m < 630)).toBe(false);
    expect(slots).not.toContain(780);
    expect(slots).toContain(900);
  });

  it("revalida um horário específico", () => {
    expect(isSlotFree({ ...base, startMin: 600 })).toBe(true);
    expect(isSlotFree({ ...base, startMin: 690 })).toBe(false);
    expect(isSlotFree({ ...base, startMin: 600, busy: [{ start: at(10, 30), end: at(11) }] })).toBe(false);
  });
});
