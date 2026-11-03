"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Users,
  Sparkles,
  Scissors,
  Wallet,
  Images,
  Settings,
  CreditCard,
  Menu,
  X,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { MotionProvider } from "@/components/motion/primitives";
import { Wordmark } from "@/components/site/wordmark";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Visão geral", icon: BarChart3, exact: true },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/agendamentos", label: "Agendamentos", icon: ClipboardList },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/profissionais", label: "Profissionais", icon: Sparkles },
  { href: "/admin/servicos", label: "Serviços", icon: Scissors },
  { href: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/admin/conteudo", label: "Galeria e conteúdo", icon: Images },
  { href: "/admin/configuracoes", label: "Configurações do estúdio", icon: Settings, exact: true },
  { href: "/admin/configuracoes/mercado-pago", label: "Integração Mercado Pago", icon: CreditCard },
];

export function AdminShell({ studioName, userName, logoLight, children }: { studioName: string; userName: string; logoLight: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  const isActive = (n: (typeof NAV)[number]) => (n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(`${n.href}/`));

  const nav = (
    <nav aria-label="Painel" className="flex flex-col gap-0.5">
      {NAV.map((n) => {
        const active = isActive(n);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.92rem] transition-colors",
              active ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-white",
            )}
          >
            {active && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[#f3b6c0]" />}
            <n.icon className="size-[18px] shrink-0 opacity-90" aria-hidden />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="space-y-1 border-t border-sidebar-border pt-4 text-sm">
      <Link href="/" target="_blank" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sidebar-foreground/75 hover:text-white">
        <ExternalLink className="size-4" /> Ver site
      </Link>
      <button
        onClick={async () => {
          await authClient.signOut();
          router.push("/entrar");
        }}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sidebar-foreground/75 hover:text-white"
      >
        <LogOut className="size-4" /> Sair ({userName.split(" ")[0]})
      </button>
    </div>
  );

  return (
    <MotionProvider>
      <div className="min-h-svh bg-[#f3efee] lg:grid lg:grid-cols-[264px_1fr]">
        <aside className="grain sticky top-0 hidden h-svh flex-col gap-8 overflow-y-auto bg-sidebar p-5 lg:flex">
          <Link href="/admin" className="px-2 pt-2">
            <Wordmark name={studioName} logo={logoLight} tone="light" className="[&>span]:text-[1.25rem]" imgClassName="h-14 max-w-[200px]" />
            <span className="eyebrow mt-1 block text-[0.6rem] text-teal-haze">Painel administrativo</span>
          </Link>
          {nav}
          <div className="mt-auto">{footer}</div>
        </aside>

        <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-sidebar px-4 text-white lg:hidden">
          <Link href="/admin"><Wordmark name={studioName} logo={logoLight} tone="light" className="[&>span]:text-[1.15rem]" imgClassName="h-10" /></Link>
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? "Fechar menu" : "Abrir menu"} className="grid size-11 place-items-center rounded-full hover:bg-white/10">
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </header>
        {open && (
          <div className="fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col gap-6 overflow-y-auto bg-sidebar p-4 lg:hidden">
            {nav}
            {footer}
          </div>
        )}

        <main id="conteudo" className="min-w-0 px-4 py-6 sm:px-8 sm:py-10">
          <div className="mx-auto max-w-[1240px]">{children}</div>
        </main>
      </div>
    </MotionProvider>
  );
}
