import { addDaysYmd, isValidYmd, todayYmd, zonedToDate } from "./time";

export type Preset = "hoje" | "7d" | "30d" | "mes" | "mes-anterior" | "ano" | "personalizado";

/** Converte filtros da URL (?periodo=&de=&ate=) num intervalo [from, to) no fuso do estúdio. */
export function rangeFromParams(sp: Record<string, string | string[] | undefined>) {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const preset = (get("periodo") as Preset) ?? "mes";
  const today = todayYmd();
  const [y, m] = today.split("-").map(Number);
  let fromYmd: string;
  let toYmdExclusive: string;
  switch (preset) {
    case "hoje":
      fromYmd = today;
      toYmdExclusive = addDaysYmd(today, 1);
      break;
    case "7d":
      fromYmd = addDaysYmd(today, -6);
      toYmdExclusive = addDaysYmd(today, 1);
      break;
    case "30d":
      fromYmd = addDaysYmd(today, -29);
      toYmdExclusive = addDaysYmd(today, 1);
      break;
    case "mes-anterior": {
      const pm = m === 1 ? 12 : m - 1;
      const py = m === 1 ? y - 1 : y;
      fromYmd = `${py}-${String(pm).padStart(2, "0")}-01`;
      toYmdExclusive = `${y}-${String(m).padStart(2, "0")}-01`;
      break;
    }
    case "ano":
      fromYmd = `${y}-01-01`;
      toYmdExclusive = `${y + 1}-01-01`;
      break;
    case "personalizado": {
      const de = get("de");
      const ate = get("ate");
      fromYmd = de && isValidYmd(de) ? de : today;
      toYmdExclusive = addDaysYmd(ate && isValidYmd(ate) && ate >= fromYmd ? ate : fromYmd, 1);
      break;
    }
    default: {
      fromYmd = `${y}-${String(m).padStart(2, "0")}-01`;
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      toYmdExclusive = `${ny}-${String(nm).padStart(2, "0")}-01`;
    }
  }
  return {
    preset: (["hoje", "7d", "30d", "mes", "mes-anterior", "ano", "personalizado"].includes(preset) ? preset : "mes") as Preset,
    fromYmd,
    toYmdInclusive: addDaysYmd(toYmdExclusive, -1),
    from: zonedToDate(fromYmd, 0),
    to: zonedToDate(toYmdExclusive, 0),
  };
}

export const PRESET_LABEL: Record<Preset, string> = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  mes: "Este mês",
  "mes-anterior": "Mês anterior",
  ano: "Este ano",
  personalizado: "Personalizado",
};
