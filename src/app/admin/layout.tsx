import type { Metadata } from "next";
import { requireAdminPage } from "@/server/session";
import { getSettings } from "@/server/settings";
import { AdminShell } from "./shell";

export const metadata: Metadata = { title: { default: "Painel", template: "%s · Painel" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdminPage();
  const s = await getSettings();
  return (
    <AdminShell studioName={s.studioName} userName={user.name}>
      {children}
    </AdminShell>
  );
}
