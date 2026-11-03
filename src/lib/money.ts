const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatBRL = (cents: number) => brl.format(cents / 100);

/** "1.234,56" | "1234.56" | "R$ 80" -> centavos. Retorna null se inválido. */
export function parseBRL(input: string): number | null {
  let s = input.replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** Centavos -> "123.45" (formato exigido pela API do Mercado Pago). */
export const centsToDecimal = (cents: number) => (cents / 100).toFixed(2);

/** "123.45" | 123.45 -> centavos */
export function decimalToCents(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
