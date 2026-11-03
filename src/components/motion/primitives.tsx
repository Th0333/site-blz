"use client";

import { MotionConfig, motion, useInView, useReducedMotion } from "motion/react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Respeita a preferência do sistema por movimento reduzido em todas as animações motion. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/**
 * Revelação por máscara, linha a linha (inspirada no "Mask Reveal Up" do Animata):
 * cada linha sobe de dentro de um recorte com leve desfoque.
 */
export function MaskReveal({
  lines,
  className,
  lineClassName,
  delay = 0,
  as: Tag = "h1",
}: {
  lines: ReactNode[];
  className?: string;
  lineClassName?: string;
  delay?: number;
  as?: "h1" | "h2" | "p";
}) {
  const reduce = useReducedMotion();
  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
          <motion.span
            className={cn("block", lineClassName)}
            initial={reduce ? false : { y: "105%", filter: "blur(4px)" }}
            animate={{ y: "0%", filter: "blur(0px)" }}
            transition={{ duration: 0.9, ease: EASE, delay: delay + i * 0.09 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Entrada suave ao rolar (variação do Blur Fade do Magic UI, com movimento reduzido). */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 14,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? false : { opacity: 0, y, filter: "blur(6px)" }}
      animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
