"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleServiceAction } from "./actions";

export function RowToggles({ id, active, featured }: { id: string; active: boolean; featured: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toggle = (field: "active" | "featured", value: boolean) =>
    start(async () => {
      const r = await toggleServiceAction(id, field, value);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  return (
    <>
      <td className="border-b border-border/70 px-4 py-3"><Switch checked={active} disabled={pending} onCheckedChange={(v) => toggle("active", v)} aria-label="Ativo" /></td>
      <td className="border-b border-border/70 px-4 py-3"><Switch checked={featured} disabled={pending} onCheckedChange={(v) => toggle("featured", v)} aria-label="Destaque" /></td>
    </>
  );
}
