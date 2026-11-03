"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { ArrowUpRight, Clock } from "lucide-react";
import type { PublicService } from "@/server/public-data";
import { formatBRL } from "@/lib/money";
import { fmtDuration } from "@/lib/time";
import { Photo } from "@/components/site/photo";
import { cn } from "@/lib/utils";

/**
 * Menu de serviços em formato de "carta" editorial: linhas por categoria,
 * com a foto do serviço em foco numa coluna fixa (desktop).
 */
export function ServicesMenu({ services }: { services: PublicService[] }) {
  const initial = services.find((s) => s.featured) ?? services[0];
  const [active, setActive] = useState<string | undefined>(initial?.id);
  const groups = useMemo(() => {
    const m = new Map<string, PublicService[]>();
    for (const s of services) m.set(s.category, [...(m.get(s.category) ?? []), s]);
    return [...m.entries()];
  }, [services]);
  const current = services.find((s) => s.id === active) ?? initial;
  const idx = services.findIndex((s) => s.id === current?.id);

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
      <div className="lg:col-span-7">
        {groups.map(([category, list]) => (
          <div key={category} className="mb-12 last:mb-0">
            <h3 className="flex items-center gap-4 font-display text-xl italic text-merlot">
              {category}
              <span aria-hidden className="h-px flex-1 bg-border" />
            </h3>
            <ul className="mt-2">
              {list.map((s) => (
                <li key={s.id}>
                  <div
                    onMouseEnter={() => setActive(s.id)}
                    onFocus={() => setActive(s.id)}
                    className={cn(
                      "group relative grid grid-cols-[72px_1fr] gap-x-4 gap-y-3 border-b border-border py-6 transition-colors sm:grid-cols-[1fr_auto] sm:gap-x-8",
                    )}
                  >
                    <span aria-hidden className={cn("absolute inset-y-0 -left-4 w-[3px] origin-top bg-cherry transition-transform duration-500", active === s.id ? "scale-y-100" : "scale-y-0")} />
                    <div className="row-span-2 sm:hidden">
                      <Photo src={s.photo} alt={s.name} className="aspect-[3/4] w-[72px]" sizes="72px" fallbackVariant={services.indexOf(s)} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h4 className="font-display text-[1.65rem] leading-tight text-petrol sm:text-[1.9rem]">{s.name}</h4>
                        {s.featured && <span className="eyebrow rounded-full bg-blush-veil px-2.5 py-1 text-[0.6rem] text-merlot">Destaque</span>}
                      </div>
                      {s.description && <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-muted-foreground line-clamp-3">{s.description}</p>}
                      <p className="mt-3 flex items-center gap-1.5 text-sm text-teal-deep">
                        <Clock className="size-3.5" aria-hidden /> {fmtDuration(s.durationMin)}
                      </p>
                    </div>
                    <div className="col-start-2 flex items-center justify-between gap-4 sm:col-start-auto sm:flex-col sm:items-end sm:justify-between">
                      <p className="text-right">
                        {s.priceFrom && <span className="block text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">a partir de</span>}
                        <span className="font-display text-2xl text-graphite">{formatBRL(s.priceCents)}</span>
                      </p>
                      <Link
                        href={`/agendar?servico=${s.id}`}
                        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-merlot/30 px-4 text-sm font-medium text-merlot transition-colors hover:bg-merlot hover:text-white focus-visible:bg-merlot focus-visible:text-white"
                        aria-label={`Agendar ${s.name}`}
                      >
                        Agendar <ArrowUpRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="hidden lg:col-span-5 lg:block">
        <div className="sticky top-28">
          <div className="relative aspect-[4/5] overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={current?.id}
                initial={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0"
              >
                <Photo src={current?.photo} alt={current?.name ?? ""} className="h-full w-full" sizes="40vw" fallbackVariant={idx} />
              </motion.div>
            </AnimatePresence>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#052f32]/85 to-transparent p-6 pt-20 text-white">
              <p className="eyebrow text-teal-haze">{current?.category}</p>
              <p className="mt-2 font-display text-3xl">{current?.name}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
