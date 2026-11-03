import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow text-teal">{eyebrow}</p>}
        <h1 className="font-display text-[2.4rem] leading-tight text-petrol sm:text-[2.8rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[0.95rem] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-border/80 bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:p-6", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[0.95rem] font-semibold text-graphite">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <p className="font-display text-2xl text-petrol">{title}</p>
      {text && <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const selectClass =
  "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-graphite outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-border/80 bg-card", className)}>
      <table className="w-full min-w-[720px] text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("border-b border-border px-4 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-border/70 px-4 py-3 align-top", className)}>{children}</td>;
}

export function TabLinks({ items, current }: { items: { href: string; label: string; key: string }[]; current: string }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-full bg-card p-1 ring-1 ring-border">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={current === i.key ? "page" : undefined}
          className={cn("rounded-full px-4 py-1.5 text-sm transition-colors", current === i.key ? "bg-petrol text-white" : "text-muted-foreground hover:text-petrol")}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}
