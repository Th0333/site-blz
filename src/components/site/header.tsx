"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X, CalendarHeart, LogOut, UserRound, LayoutDashboard } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Wordmark } from "./wordmark";
import { LiquidGlass } from "./liquid-glass";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/#servicos", label: "Serviços" },
  { href: "/#profissionais", label: "Profissionais" },
  { href: "/#sobre", label: "Sobre nós" },
  { href: "/#contato", label: "Contato" },
];

type HeaderUser = { name: string; role: string } | null;

/** Seções escuras marcam-se com data-nav="dark": a navbar troca o texto para claro sobre elas. */
function isOverDarkSection() {
  const y = 44;
  return [...document.querySelectorAll<HTMLElement>('[data-nav="dark"]')].some((el) => {
    const r = el.getBoundingClientRect();
    return r.top <= y && r.bottom >= y;
  });
}

export function SiteHeader({ studioName, logo, user }: { studioName: string; logo: string | null; user: HeaderUser }) {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  // a página inicial abre sobre o hero escuro: já começa com texto claro (sem "piscar")
  const [onDark, setOnDark] = useState(() => pathname === "/");
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const router = useRouter();

  const sync = useCallback(() => {
    setScrolled(window.scrollY > 24);
    setOnDark(isOverDarkSection());
  }, []);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    // Observa uma "linha" na altura da navbar: troca de modo mesmo em rolagens que não disparam "scroll"
    const io = new IntersectionObserver(onScroll, { rootMargin: `-44px 0px -${Math.max(0, window.innerHeight - 45)}px 0px` });
    document.querySelectorAll('[data-nav="dark"]').forEach((el) => io.observe(el));
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sync, pathname]);

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

  const light = onDark && !open; // texto claro sobre fundo escuro
  const compact = scrolled || open;
  const firstName = user?.name.split(" ")[0];

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <a href="#conteudo" className="pointer-events-auto sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-paper focus:px-4 focus:py-2 focus:text-petrol">
        Pular para o conteúdo
      </a>

      {/* Navbar em Liquid Glass: pílula transparente que refrata o fundo nas bordas */}
      <LiquidGlass
        className={cn(
          "pointer-events-auto mx-auto flex max-w-[1240px] items-center gap-2 p-1.5 transition-colors duration-500 sm:p-2",
          light ? "text-white" : "text-petrol",
        )}
        tint={light ? "rgb(255 255 255 / 0.07)" : "rgb(255 255 255 / 0.38)"}
        fallbackBlur={light ? 12 : 18}
        depth={22}
        strength={48}
      >
        {/* Logo numa cápsula de vidro leitosa (como o item selecionado de uma toolbar): sempre legível e nas cores originais */}
        <Link
          href="/"
          aria-label={`${studioName} — página inicial`}
          className={cn(
            "liquid-glass-rim relative flex shrink-0 items-center justify-center rounded-full bg-white/80 px-5 transition-[height,padding] duration-500 sm:px-6",
            compact ? "h-[58px]" : "h-[64px] sm:h-[74px]",
          )}
        >
          <Wordmark
            name={studioName}
            logo={logo}
            imgClassName={cn("w-auto max-w-none transition-[height] duration-500", compact ? "h-[54px]" : "h-[60px] sm:h-[70px]")}
          />
        </Link>

        <nav aria-label="Principal" className="ml-auto hidden items-center lg:flex" onMouseLeave={() => setHovered(null)}>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onMouseEnter={() => setHovered(n.href)}
              onFocus={() => setHovered(n.href)}
              onBlur={() => setHovered(null)}
              className={cn("relative rounded-full px-4 py-2.5 text-[0.92rem] font-medium tracking-wide transition-colors", light && "[text-shadow:0_1px_8px_rgb(0_0_0/0.25)]")}
            >
              {hovered === n.href && (
                <motion.span
                  layoutId="nav-glass"
                  transition={{ type: "spring", duration: 0.45, bounce: 0.18 }}
                  className={cn("liquid-glass-rim absolute inset-0 rounded-full", light ? "bg-white/15" : "bg-white/60")}
                />
              )}
              <span className="relative">{n.label}</span>
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 pr-1 lg:ml-2">
          {user ? (
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setMenu((v) => !v)}
                aria-expanded={menu}
                aria-haspopup="menu"
                className={cn(
                  "liquid-glass-rim flex h-11 items-center gap-2 rounded-full pl-1.5 pr-4 text-sm font-medium transition-colors",
                  light ? "bg-white/10 hover:bg-white/20" : "bg-white/55 hover:bg-white/75",
                )}
              >
                <span className="grid size-8 place-items-center rounded-full bg-merlot font-display text-[0.95rem] italic text-white">
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
                    className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-border bg-card p-1.5 text-graphite shadow-xl"
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
              className="link-swipe hidden px-3 text-sm font-medium sm:inline"
            >
              Entrar
            </Link>
          )}
          <Link href="/agendar" className={cn(buttonVariants({ size: "lg" }), "hidden h-11 shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_6px_16px_-6px_rgb(112_26_46/0.7)] sm:inline-flex")}>
            Agendar horário
          </Link>
          <button
            type="button"
            className={cn("liquid-glass-rim grid size-11 place-items-center rounded-full lg:hidden", light ? "bg-white/10" : "bg-white/55")}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </LiquidGlass>

      <AnimatePresence>
        {open && (
          <motion.div
            id="menu-mobile"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto fixed inset-x-3 bottom-3 top-[90px] z-40 flex flex-col overflow-y-auto rounded-[28px] bg-paper px-6 pb-8 pt-4 shadow-2xl ring-1 ring-border sm:inset-x-5 lg:hidden"
          >
            <nav aria-label="Menu" className="flex flex-col">
              {NAV.map((n, i) => (
                <motion.div key={n.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 + i * 0.05 }}>
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
