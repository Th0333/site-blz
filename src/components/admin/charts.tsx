"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/money";

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** Receita recebida por dia, separando online e presencial (somente dinheiro confirmado). */
export function RevenueChart({ data }: { data: { ymd: string; online: number; inPerson: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: `${d.ymd.slice(8, 10)}/${d.ymd.slice(5, 7)}` }));
  if (!rows.some((r) => r.online || r.inPerson)) {
    return <p className="grid h-64 place-items-center text-sm text-muted-foreground">Nenhum recebimento confirmado no período.</p>;
  }
  return (
    <div className="h-72 w-full" role="img" aria-label="Gráfico de receita recebida por dia">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v: number) => compact.format(v / 100)} width={44} />
          <Tooltip
            cursor={{ fill: "rgba(15,107,110,0.06)" }}
            contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 13 }}
            formatter={(v, n) => [formatBRL(Number(v)), n === "online" ? "Online" : "Presencial"]}
            labelFormatter={(l) => `Dia ${l}`}
          />
          <Bar dataKey="inPerson" stackId="a" fill="var(--brand-teal)" radius={[0, 0, 2, 2]} />
          <Bar dataKey="online" stackId="a" fill="var(--brand-merlot)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras horizontais simples (sem biblioteca) para rankings. */
export function RankBars({ items, format }: { items: { name: string; value: number }[]; format?: "brl" | "count" }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no período.</p>;
  return (
    <ul className="space-y-3">
      {items.map((i, idx) => (
        <li key={i.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-graphite">{i.name}</span>
            <span className="shrink-0 font-medium tabular-nums">{format === "brl" ? formatBRL(i.value) : i.value}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: idx % 2 ? "var(--brand-teal)" : "var(--brand-merlot)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
