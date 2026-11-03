import Image from "next/image";
import { cn } from "@/lib/utils";
import { SwatchArt } from "./swatch";

/**
 * Foto administrável. As imagens já são otimizadas no upload (WebP, máx. 1800px),
 * por isso não passam pelo otimizador do Next. Sem foto, exibe a arte de swatches da marca.
 */
export function Photo({
  src,
  alt,
  className,
  imgClassName,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority,
  fallbackVariant = 0,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  sizes?: string;
  priority?: boolean;
  fallbackVariant?: number;
}) {
  if (!src) return <SwatchArt className={cn("h-full w-full", className)} label={alt} variant={fallbackVariant} />;
  return (
    <div className={cn("relative overflow-hidden bg-teal-deep", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized
        className={cn("object-cover", imgClassName)}
      />
    </div>
  );
}
