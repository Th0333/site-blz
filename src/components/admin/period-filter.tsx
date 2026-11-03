"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PRESET_LABEL, type Preset } from "@/lib/range";
import { cn } from "@/lib/utils";

export function PeriodFilter({ preset, from, to }: { preset: Preset; from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [de, setDe] = useState(from);
  const [ate, setAte] = useState(to);
  const go = (p: Preset, extra: Record<string, string> = {}) => {
    const q = new URLSearchParams(sp.toString());
    q.set("periodo", p);
    q.delete("de");
    q.delete("ate");
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
    router.push(`${pathname}?${q.toString()}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap gap-1 rounded-full bg-card p-1 ring-1 ring-border">
        {(["hoje", "7d", "30d", "mes", "mes-anterior", "ano"] as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => go(p)}
            aria-pressed={preset === p}
            className={cn("rounded-full px-3 py-1.5 text-xs font-medium sm:text-sm", preset === p ? "bg-petrol text-white" : "text-muted-foreground hover:text-petrol")}
          >
            {PRESET_LABEL[p]}
          </button>
        ))}
      </div>
      <form
        className="flex items-center gap-1.5 rounded-full bg-card p-1 pl-3 text-sm ring-1 ring-border"
        onSubmit={(e) => {
          e.preventDefault();
          go("personalizado", { de, ate });
        }}
      >
        <label className="sr-only" htmlFor="pf-de">De</label>
        <input id="pf-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} className="bg-transparent text-xs outline-none sm:text-sm" />
        <span className="text-muted-foreground">–</span>
        <label className="sr-only" htmlFor="pf-ate">Até</label>
        <input id="pf-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="bg-transparent text-xs outline-none sm:text-sm" />
        <button className={cn("rounded-full px-3 py-1.5 text-xs font-medium", preset === "personalizado" ? "bg-petrol text-white" : "bg-teal-mist text-teal-deep")}>Aplicar</button>
      </form>
    </div>
  );
}
