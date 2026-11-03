import Link from "next/link";
import type { StudioSettings } from "@/lib/settings-schema";
import { instagramLink, whatsappLink } from "@/lib/media-url";
import { Wordmark } from "./wordmark";

export function SiteFooter({ s, logo, logoLight }: { s: StudioSettings; logo: string | null; logoLight: string | null }) {
  const wa = whatsappLink(s.whatsapp, `Olá! Vim pelo site do ${s.studioName}.`);
  const ig = instagramLink(s.instagram);
  const year = new Date().getFullYear();
  return (
    <footer data-nav="dark" className="grain bg-petrol text-[#d9e7e6]">
      <div className="mx-auto grid max-w-[1320px] gap-12 px-4 pb-10 pt-16 sm:px-6 md:grid-cols-12 lg:px-10">
        <div className="md:col-span-5">
          <Wordmark name={s.studioName} logo={logo} logoLight={logoLight} tone="light" imgClassName="h-20 max-w-[260px]" />
          <p className="mt-5 max-w-sm text-[0.95rem] leading-relaxed text-[#b6cfcd]">{s.tagline}</p>
          <Link href="/agendar" className="mt-8 inline-flex items-center gap-3 font-display text-2xl italic text-white">
            Reserve seu horário
            <span aria-hidden className="inline-block h-px w-10 bg-[#f3b6c0]" />
          </Link>
        </div>

        <div className="md:col-span-3">
          <h2 className="eyebrow text-[#8fb5b2]">Visite</h2>
          {s.address ? <p className="mt-4 whitespace-pre-line text-[0.95rem] leading-relaxed">{s.address}</p> : <p className="mt-4 text-[0.95rem] text-[#8fb5b2]">Endereço em breve.</p>}
          {s.openingHours.length > 0 && (
            <dl className="mt-5 space-y-1.5 text-[0.9rem]">
              {s.openingHours.map((h) => (
                <div key={h.label} className="flex gap-3">
                  <dt className="min-w-28 text-[#8fb5b2]">{h.label}</dt>
                  <dd>{h.hours}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="md:col-span-2">
          <h2 className="eyebrow text-[#8fb5b2]">Contato</h2>
          <ul className="mt-4 space-y-2.5 text-[0.95rem]">
            {wa && <li><a className="link-swipe" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a></li>}
            {ig && <li><a className="link-swipe" href={ig.url} target="_blank" rel="noopener noreferrer">Instagram {ig.handle}</a></li>}
            {s.email && <li><a className="link-swipe break-all" href={`mailto:${s.email}`}>{s.email}</a></li>}
            {s.phone && <li><a className="link-swipe" href={`tel:${s.phone.replace(/\D/g, "")}`}>{s.phone}</a></li>}
          </ul>
        </div>

        <div className="md:col-span-2">
          <h2 className="eyebrow text-[#8fb5b2]">Estúdio</h2>
          <ul className="mt-4 space-y-2.5 text-[0.95rem]">
            <li><Link className="link-swipe" href="/minha-conta">Minha conta</Link></li>
            <li><Link className="link-swipe" href="/privacidade">Privacidade</Link></li>
            <li><Link className="link-swipe" href="/termos">Termos de uso</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-4 py-6 text-xs text-[#8fb5b2] sm:flex-row sm:justify-between sm:px-6 lg:px-10">
          <p>© {year} {s.studioName}. Todos os direitos reservados.</p>
          <p>Seus dados são tratados conforme a LGPD. <Link href="/privacidade" className="underline underline-offset-2">Saiba como</Link>.</p>
        </div>
      </div>
    </footer>
  );
}
