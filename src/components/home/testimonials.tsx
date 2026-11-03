"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

type T = { id: string; author: string; text: string; rating: number | null; service: string | null };

/** Depoimentos aprovados — citação editorial com palavras que surgem do desfoque (inspirado em Aceternity Animated Testimonials). */
export function Testimonials({ items }: { items: T[] }) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  const t = items[i];
  const go = (d: number) => setI((v) => (v + d + items.length) % items.length);
  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-9" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.figure key={t.id} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            <blockquote className="font-display text-[clamp(1.7rem,3.6vw,3rem)] leading-[1.15] text-petrol">
              <span aria-hidden className="mr-1 text-cherry">“</span>
              {t.text.split(" ").map((w, k) => (
                <motion.span
                  key={k}
                  initial={reduce ? false : { filter: "blur(10px)", opacity: 0, y: 5 }}
                  animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.015 * k }}
                  className="inline-block"
                >
                  {w}&nbsp;
                </motion.span>
              ))}
              <span aria-hidden className="text-cherry">”</span>
            </blockquote>
            <figcaption className="mt-8 flex items-center gap-4">
              <span aria-hidden className="h-px w-10 bg-merlot" />
              <span>
                <span className="block font-semibold text-graphite">{t.author}</span>
                {t.service && <span className="text-sm text-muted-foreground">{t.service}</span>}
              </span>
            </figcaption>
          </motion.figure>
        </AnimatePresence>
      </div>
      {items.length > 1 && (
        <div className="flex items-end gap-3 lg:col-span-3 lg:justify-end">
          <span className="mr-auto font-display text-lg text-muted-foreground lg:mr-4">
            {String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
          </span>
          <button onClick={() => go(-1)} aria-label="Depoimento anterior" className="grid size-12 place-items-center rounded-full border border-petrol/25 text-petrol transition-colors hover:bg-petrol hover:text-white">
            <ArrowLeft className="size-5" />
          </button>
          <button onClick={() => go(1)} aria-label="Próximo depoimento" className="grid size-12 place-items-center rounded-full bg-petrol text-white transition-colors hover:bg-teal">
            <ArrowRight className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
