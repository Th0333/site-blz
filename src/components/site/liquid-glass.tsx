"use client";

import { useSyncExternalStore } from "react";

/**
 * Filtro SVG da refração do Liquid Glass: um ruído suave desloca levemente
 * o que está atrás do vidro, como uma lente. Usado via `backdrop-filter: url(#liquid-glass)`.
 */
export function LiquidGlassFilter() {
  return (
    <svg aria-hidden width="0" height="0" className="pointer-events-none absolute">
      <filter id="liquid-glass" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.018" numOctaves="2" seed="11" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="2.5" result="soft" />
        <feDisplacementMap in="SourceGraphic" in2="soft" scale="34" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

/**
 * A refração por `backdrop-filter: url()` só funciona em navegadores Chromium (Chrome, Edge, Opera).
 * Nos demais (Safari, Firefox) o vidro continua fosco, sem a distorção — nunca quebra.
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
