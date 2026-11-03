"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ArrowDownRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { MaskReveal } from "@/components/motion/primitives";
import { SwatchWord } from "@/components/site/swatch";
import { Photo } from "@/components/site/photo";
import { cn } from "@/lib/utils";

/** Divide o título administrável em linhas por frase e destaca as duas últimas palavras com o swatch. */
function splitTitle(title: string) {
  const sentences = title.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [title];
  const last = sentences.pop() ?? "";
  const words = last.split(" ");
  const tail = words.splice(Math.max(1, words.length - 2)).join(" ");
  return { lead: sentences, lastHead: words.join(" "), tail };
}

export function Hero({
  eyebrow,
  title,
  subtitle,
  image,
  secondaryImage,
  studioName,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  image: string | null;
  secondaryImage: string | null;
  studioName: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "12%"]);
  const { lead, lastHead, tail } = splitTitle(title);

  const lines = [
    ...lead.map((l) => <span key={l}>{l}</span>),
    lastHead ? <span key="h">{lastHead}</span> : null,
    <em key="t" className="not-italic">
      <SwatchWord delay={1.05} color="var(--brand-cherry)">
        <span className="italic text-[#fbe9ec]">{tail}</span>
      </SwatchWord>
    </em>,
  ].filter(Boolean);

  return (
    <section ref={ref} className="grain relative overflow-hidden bg-petrol text-white">
      {/* halo merlot por trás da fotografia */}
      <div aria-hidden className="pointer-events-none absolute -right-40 top-10 h-[620px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(112,26,46,0.75),transparent)] blur-2xl" />
      <div className="relative mx-auto grid min-h-[100svh] max-w-[1320px] grid-cols-1 items-end gap-10 px-4 pb-14 pt-28 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-6 lg:px-10 lg:pb-20 lg:pt-32">
        <div className="relative z-10 lg:col-span-7">
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="eyebrow flex items-center gap-3 text-teal-haze"
          >
            <span aria-hidden className="inline-block h-px w-8 bg-[#f3b6c0]" />
            {eyebrow}
          </motion.p>
          <MaskReveal
            delay={0.15}
            className="display mt-6 text-[clamp(3.1rem,8.6vw,7.4rem)] text-white"
            lines={lines}
          />
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.75 }}
            className="mt-8 max-w-[34rem] text-[1.05rem] leading-relaxed text-[#cfe0df] sm:text-lg"
          >
            {subtitle}
          </motion.p>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.9 }}
            className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link href="/agendar" className={cn(buttonVariants({ size: "lg" }), "bg-cherry hover:bg-merlot")}>
              Agendar meu horário
            </Link>
            <Link href="/#servicos" className={cn(buttonVariants({ variant: "outline-light", size: "lg" }), "bg-transparent")}>
              Conhecer nossos serviços <ArrowDownRight className="size-4" />
            </Link>
          </motion.div>
        </div>

        <div className="relative lg:col-span-5 lg:self-stretch">
          <motion.div
            initial={reduce ? false : { clipPath: "inset(100% 0 0 0)" }}
            animate={{ clipPath: "inset(0% 0 0 0)" }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            className="relative ml-auto aspect-[4/5] w-[86%] max-w-[480px] overflow-hidden rounded-[2px] lg:mt-6 lg:aspect-auto lg:h-[min(76svh,720px)] lg:w-full"
          >
            <motion.div style={{ y: imgY }} className="absolute inset-[-6%]">
              <Photo src={image} alt={`Atendimento no ${studioName}`} priority sizes="(max-width: 1024px) 86vw, 40vw" className="h-full w-full" fallbackVariant={0} />
            </motion.div>
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#052f32]/50 via-transparent to-transparent" />
          </motion.div>
          {/* moldura deslocada em cereja: o "espelho" do camarim */}
          <div aria-hidden className="pointer-events-none absolute -bottom-4 right-[-10px] hidden h-[70%] w-[78%] border border-[#c45a68]/70 lg:block" />
          {secondaryImage && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.9 }}
              className="absolute -bottom-6 left-0 hidden aspect-square w-[38%] overflow-hidden border-[6px] border-petrol sm:block lg:-left-10"
            >
              <Photo src={secondaryImage} alt="Detalhe de maquiagem" sizes="20vw" className="h-full w-full" />
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
