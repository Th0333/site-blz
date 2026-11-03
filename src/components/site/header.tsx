"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X, CalendarHeart, LogOut, UserRound, LayoutDashboard } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Wordmark } from "./wordmark";
import { LiquidGlassFilter, useRefraction } from "./liquid-glass";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/#servicos", label: "Serviços" },
  { href: "/#profissionais", label: "Profissionais" },
  { href: "/#sobre", label: "Sobre nós" },
  { href: "/#contato", label: "Contato" },
];

type HeaderUser = { name: string; role: string } | null;

export function SiteHeader({ studioName, logo, user }: { studioName: string; logo: string | null; user: HeaderUser }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
    setMenu(false);
  }
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const refract = useRefraction();
  const firstName = user?.name.split(" ")[0];

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 text-petrol sm:px-5 sm:pt-4">
      <LiquidGlassFilter />
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-paper focus:px-4 focus:py-2 focus:text-petrol">
        Pular para o conteúdo
      </a>
      {/* Navbar em "Liquid Glass": pílula de vidro flutuante, sempre clara para a logo manter as cores */}
      <div
        data-refract={refract}
        className={cn(
          "liquid-glass pointer-events-auto mx-auto flex max-w-[1240px] items-center gap-6 rounded-full pl-4 pr-2 transition-[height] duration-500 sm:pl-6 sm:pr-3",
          scrolled || open ? "h-[64px]" : "h-[68px] sm:h-[78px]",
        )}
      >
        <Link href="/" className="shrink-0" aria-label={`${studioName} — página inicial`}>
          <Wordmark name={studioName} logo={logo} imgClassName={cn("w-auto max-w-none transition-[height] duration-500", scrolled || open ? "h-[50px]" : "h-[54px] sm:h-[62px]")} />
        </Link>

        <nav aria-label="Principal" className="ml-auto hidden items-center gap-7 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="link-swipe text-[0.9rem] font-medium tracking-wide opacity-90 hover:opacity-100">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-6">
          {user ? (
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setMenu((v) => !v)}
                aria-expanded={menu}
                aria-haspopup="menu"
                className={cn(
                  "flex h-10 items-center gap-2 rounded-full border border-white/70 bg-white/40 pl-1.5 pr-3.5 text-sm font-medium transition-colors hover:bg-white/70",
                )}
              >
                <span className="grid size-7 place-items-center rounded-full bg-merlot font-display text-[0.95rem] italic text-white">
                  {firstName?.[0]?.toUpperCase()}
                </span>
                {firstName}
              </button>
              <AnimatePresence>
                {menu && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-card p-1.5 text-graphite shadow-xl"
                  >
                    <MenuLink href="/minha-conta" icon={<UserRound className="size-4" />}>Minha conta</MenuLink>
                    {user.role === "admin" && <MenuLink href="/admin" icon={<LayoutDashboard className="size-4" />}>Painel administrativo</MenuLink>}
                    {user.role === "professional" && <MenuLink href="/profissional" icon={<CalendarHeart className="size-4" />}>Minha agenda</MenuLink>}
                    <button role="menuitem" onClick={signOut} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted">
                      <LogOut className="size-4" /> Sair
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              href={`/entrar?next=${encodeURIComponent(pathname || "/")}`}
              onClick={(e) => {
                // preserva também os parâmetros (ex.: escolhas do agendamento)
                e.preventDefault();
                router.push(`/entrar?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
              }}
              className="link-swipe hidden text-sm font-medium sm:inline"
            >
              Entrar
            </Link>
          )}
          <Link href="/agendar" className={cn(buttonVariants({ size: "default" }), "hidden sm:inline-flex")}>
            Agendar horário
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full hover:bg-white/60 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="menu-mobile"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto fixed inset-x-3 bottom-3 top-[84px] z-40 flex flex-col overflow-y-auto rounded-[28px] bg-paper px-6 pb-8 pt-4 shadow-2xl ring-1 ring-border sm:inset-x-5 lg:hidden"
          >
            <nav aria-label="Menu" className="flex flex-col">
              {NAV.map((n, i) => (
                <motion.div key={n.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.05 }}>
                  <Link href={n.href} onClick={() => setOpen(false)} className="flex items-baseline justify-between border-b border-border py-4 font-display text-[2rem] text-petrol">
                    {n.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-3 pt-8">
              <Link href="/agendar" className={cn(buttonVariants({ size: "lg" }), "w-full")}>Agendar horário</Link>
              {user ? (
                <>
                  <Link href="/minha-conta" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>Minha conta</Link>
                  {user.role === "admin" && <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>Painel administrativo</Link>}
                  <button onClick={signOut} className="py-2 text-sm text-muted-foreground underline underline-offset-4">Sair da conta</button>
                </>
              ) : (
                <Link href="/entrar" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>Entrar ou criar conta</Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link role="menuitem" href={href} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm hover:bg-muted">
      {icon}
      {children}
    </Link>
  );
}
