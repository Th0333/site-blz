"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Liquid Glass no estilo da Apple: vidro quase transparente cujo fundo é "lenteado"
 * nas bordas. A refração vem de um mapa de deslocamento gerado para o tamanho exato
 * do elemento (forte perto da borda, nulo no centro), aplicado via backdrop-filter.
 *
 * - Chromium (Chrome, Edge, Opera): refração real + leve aberração cromática.
 * - Safari/Firefox ou "reduzir transparência/movimento": vidro limpo com desfoque, sem refração.
 */

function supportsRefraction() {
  if (typeof navigator === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce), (prefers-reduced-transparency: reduce)").matches) return false;
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  return !!brands?.some((b) => b.brand === "Chromium");
}

export function useRefraction() {
  return useSyncExternalStore(
    () => () => {},
    supportsRefraction,
    () => false,
  );
}

/** Mapa de deslocamento de uma cápsula/retângulo arredondado: R = deslocamento x, G = deslocamento y. */
function displacementMap(w: number, h: number, radius: number, depth: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  const r = Math.min(radius, h / 2, w / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - w / 2;
      const py = y + 0.5 - h / 2;
      const qx = Math.max(Math.abs(px) - (w / 2 - r), 0);
      const qy = Math.max(Math.abs(py) - (h / 2 - r), 0);
      let d: number;
      let nx = 0;
      let ny = 0;
      if (qx > 0 || qy > 0) {
        const len = Math.hypot(qx, qy) || 1;
        d = r - len;
        nx = (Math.sign(px) * qx) / len;
        ny = (Math.sign(py) * qy) / len;
      } else {
        const dl = w / 2 - Math.abs(px);
        const dt = h / 2 - Math.abs(py);
        if (dl < dt) {
          d = dl;
          nx = Math.sign(px);
        } else {
          d = dt;
          ny = Math.sign(py);
        }
      }
      // intensidade: máxima na borda, some suavemente até "depth" px para dentro
      const t = Math.max(0, Math.min(1, 1 - d / depth));
      const k = t * t * (3 - 2 * t);
      const i = (y * w + x) * 4;
      img.data[i] = Math.round(128 - nx * k * 127);
      img.data[i + 1] = Math.round(128 - ny * k * 127);
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

type Size = { w: number; h: number };

export function LiquidGlass({
  children,
  className,
  style,
  radius = 9999,
  depth = 24,
  strength = 46,
  tint = "rgb(255 255 255 / 0.08)",
  blur = 2,
  fallbackBlur = 14,
  as: Tag = "div",
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  radius?: number;
  /** largura (px) da faixa de lente junto à borda */
  depth?: number;
  /** intensidade da refração (px) */
  strength?: number;
  tint?: string;
  blur?: number;
  fallbackBlur?: number;
  as?: "div" | "span";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = `lg-${useId().replace(/:/g, "")}`;
  const refract = useRefraction();
  const [size, setSize] = useState<Size | null>(null);
  const [map, setMap] = useState<string | null>(null);

  useEffect(() => {
    if (!refract || !ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.borderBoxSize?.[0]?.inlineSize ?? el.offsetWidth);
      const h = Math.round(e.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight);
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [refract]);

  useEffect(() => {
    if (!size || size.w < 4 || size.h < 4) return;
    setMap(displacementMap(size.w, size.h, radius, depth));
  }, [size, radius, depth]);

  const useMap = refract && map && size;
  const backdrop = useMap
    ? `blur(${blur}px) url(#${id}) saturate(165%) brightness(1.05)`
    : `blur(${fallbackBlur}px) saturate(165%) brightness(1.05)`;

  return (
    <Tag
      ref={ref as never}
      className={cn("liquid-glass-rim relative isolate", className)}
      style={{ ...style, borderRadius: radius, background: tint, backdropFilter: backdrop, WebkitBackdropFilter: backdrop }}
    >
      {useMap && (
        <svg aria-hidden width="0" height="0" className="pointer-events-none absolute">
          <filter id={id} x="0" y="0" width={size.w} height={size.h} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage href={map} x="0" y="0" width={size.w} height={size.h} preserveAspectRatio="none" result="map" />
            {/* aberração cromática sutil: cada canal refrata um pouco diferente, como no vidro real */}
            <feDisplacementMap in="SourceGraphic" in2="map" scale={strength} xChannelSelector="R" yChannelSelector="G" result="dR" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={strength * 1.08} xChannelSelector="R" yChannelSelector="G" result="dG" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={strength * 1.16} xChannelSelector="R" yChannelSelector="G" result="dB" />
            <feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
            <feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
            <feBlend in="r" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="b" mode="screen" />
          </filter>
        </svg>
      )}
      {children}
    </Tag>
  );
}
