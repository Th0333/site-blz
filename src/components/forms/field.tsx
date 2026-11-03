import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Campo de formulário acessível: rótulo, dica e erro ligados ao controle via aria-describedby. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
  optional,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-[0.85rem] font-medium text-graphite">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

export function FormNotice({ children, tone = "teal" }: { children: ReactNode; tone?: "teal" | "merlot" }) {
  return (
    <div className={cn("rounded-xl px-4 py-3 text-sm", tone === "teal" ? "bg-teal-mist text-teal-deep" : "bg-blush-veil text-merlot")}>
      {children}
    </div>
  );
}
