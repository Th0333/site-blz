"use client";

import Link from "next/link";
import { useState } from "react";
import type { PublicProfessional } from "@/server/public-data";
import { Photo } from "@/components/site/photo";
import { cn } from "@/lib/utils";

/**
 * Retratos das profissionais com o efeito "Focus Cards" (Aceternity UI):
 * ao focar uma, as demais recuam com leve desfoque.
 */
export function ProfessionalsGrid({ pros }: { pros: PublicProfessional[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 lg:gap-8">
      {pros.map((p, i) => (
        <li
          key={p.id}
          onMouseEnter={() => setHovered(p.id)}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered(p.id)}
          onBlur={() => setHovered(null)}
          className={cn(
            "group w-[78vw] max-w-[360px] shrink-0 snap-start transition-all duration-300 ease-out sm:w-auto sm:max-w-none",
            hovered && hovered !== p.id && "sm:scale-[0.98] sm:opacity-60 sm:blur-[2px]",
            i % 3 === 1 && "lg:translate-y-12",
          )}
        >
          <article>
            <div className="relative aspect-[3/4] overflow-hidden">
              <Photo
                src={p.photo}
                alt={`Retrato de ${p.displayName}`}
                className="h-full w-full"
                imgClassName="transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                sizes="(max-width: 640px) 78vw, (max-width: 1024px) 45vw, 30vw"
                fallbackVariant={i + 1}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#340b17]/80 via-[#340b17]/0 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />
              {p.bio && (
                <p className="absolute inset-x-0 bottom-0 translate-y-2 p-5 text-[0.92rem] leading-relaxed text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                  {p.bio.length > 180 ? `${p.bio.slice(0, 177)}…` : p.bio}
                </p>
              )}
            </div>
            <div className="mt-5">
              {p.specialties.length > 0 && <p className="eyebrow text-teal">{p.specialties.slice(0, 3).join(" · ")}</p>}
              <h3 className="mt-2 font-display text-[2rem] leading-none text-petrol">{p.displayName}</h3>
              <p className="mt-3 line-clamp-2 text-[0.95rem] leading-relaxed text-muted-foreground sm:hidden">{p.bio}</p>
              <Link
                href={`/agendar?profissional=${p.id}`}
                className="link-swipe mt-4 inline-block text-sm font-semibold text-merlot"
              >
                Agendar com esta profissional
              </Link>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
