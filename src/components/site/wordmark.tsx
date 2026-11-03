/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/**
 * Logotipo tipográfico gerado a partir do nome do estúdio (didone + itálico na última palavra).
 * Quando a administradora envia um logotipo, ele substitui o wordmark.
 */
export function Wordmark({
  name,
  logo,
  logoLight,
  tone = "dark",
  className,
  imgClassName,
}: {
  name: string;
  logo?: string | null;
  logoLight?: string | null;
  tone?: "dark" | "light";
  className?: string;
  imgClassName?: string;
}) {
  const src = tone === "light" ? (logoLight ?? logo) : logo;
  if (src) {
    return <img src={src} alt={name} className={cn("h-12 w-auto max-w-[200px] object-contain", imgClassName)} />;
  }
  const words = name.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : null;
  return (
    <span className={cn("flex items-baseline gap-1.5 font-display leading-none", tone === "light" ? "text-white" : "text-petrol", className)}>
      <span className="text-[1.45rem] tracking-[-0.01em]">{words.join(" ")}</span>
      {last && <span className={cn("text-[1.45rem] italic", tone === "light" ? "text-[#f3b6c0]" : "text-cherry")}>{last}</span>}
    </span>
  );
}
