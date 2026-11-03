"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Assinatura visual da marca: o "swatch" — o traço de batom que maquiadoras fazem para testar cor.
 * Desenha-se sob a palavra destacada quando entra na tela.
 */
export function SwatchWord({
  children,
  color = "var(--brand-cherry)",
  className,
  delay = 0.6,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, "");
  return (
    <span ref={ref} className={cn("relative inline-block whitespace-nowrap", className)}>
      <svg
        aria-hidden
        viewBox="0 0 400 60"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -left-[4%] bottom-[0.04em] -z-0 h-[0.5em] w-[108%]"
      >
        <defs>
          {/* região do filtro em coordenadas do viewBox: senão o traço largo é recortado */}
          <filter id={`rough-${id}`} filterUnits="userSpaceOnUse" x="-10" y="-10" width="420" height="80">
            <feTurbulence type="fractalNoise" baseFrequency="0.03 0.6" numOctaves="2" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="6" />
          </filter>
        </defs>
        <motion.path
          d="M6 38 C 70 22, 150 30, 210 26 S 340 18, 394 30"
          fill="none"
          stroke={color}
          strokeWidth="44"
          strokeLinecap="round"
          filter={`url(#rough-${id})`}
          initial={reduce ? false : { pathLength: 0, opacity: 0.6 }}
          animate={inView ? { pathLength: 1, opacity: 0.92 } : undefined}
          transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1], delay }}
        />
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}

/** Traço isolado (usado como marcador de etapa e em composições). */
export function SwatchStroke({ color, className, filled = true }: { color: string; className?: string; filled?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 120 28" className={className} preserveAspectRatio="none">
      <path
        d="M6 17 C 30 8, 60 14, 84 11 S 108 10, 114 14"
        fill="none"
        stroke={color}
        strokeWidth="13"
        strokeLinecap="round"
        opacity={filled ? 0.95 : 0.25}
      />
    </svg>
  );
}

/**
 * Arte de reserva quando a estúdio ainda não enviou fotos: uma "cartela" de swatches
 * nas cores da marca — nunca uma caixa cinza vazia.
 */
export function SwatchArt({ className, label, variant = 0 }: { className?: string; label?: string; variant?: number }) {
  const palettes = [
    ["#8b1022", "#701a2e", "#c45a68", "#0f6b6e"],
    ["#0f6b6e", "#136f73", "#b9d6d4", "#701a2e"],
    ["#340b17", "#6e0d1b", "#8b1022", "#dfeceb"],
  ];
  const p = palettes[variant % palettes.length];
  const bg = variant % 3 === 2 ? "#f1e3e4" : variant % 3 === 1 ? "#052f32" : "#0a4f53";
  return (
    <div className={cn("relative grain overflow-hidden", className)} style={{ background: bg }} role={label ? "img" : undefined} aria-label={label}>
      <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
        {p.map((c, i) => (
          <path
            key={c + i}
            d={`M${-20 + i * 6} ${110 + i * 62} C 60 ${80 + i * 60}, 150 ${130 + i * 58}, 230 ${96 + i * 64} S 300 ${100 + i * 60}, 330 ${112 + i * 60}`}
            stroke={c}
            strokeWidth={44 - i * 4}
            strokeLinecap="round"
            fill="none"
            opacity={0.9}
            transform={`rotate(${-12 + i * 3} 150 200)`}
          />
        ))}
      </svg>
    </div>
  );
}
