import { STATUS_TONE } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, label, dark, className }: { status: string; label: string; dark?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        dark ? "bg-white/10 text-white ring-white/25" : STATUS_TONE[status] ?? "bg-muted text-muted-foreground ring-border",
        className,
      )}
    >
      {label}
    </span>
  );
}
