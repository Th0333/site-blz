import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { WhatsAppFab } from "@/components/site/whatsapp-fab";
import { MotionProvider } from "@/components/motion/primitives";
import { getSettings } from "@/server/settings";
import { getSessionUser } from "@/server/session";
import { mediaUrl } from "@/lib/media-url";
import { hasDemoData } from "@/server/demo";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [s, user, demo] = await Promise.all([getSettings(), getSessionUser(), hasDemoData()]);
  const logo = mediaUrl(s.logoId);
  const logoLight = mediaUrl(s.logoLightId);
  return (
    <MotionProvider>
      <SiteHeader studioName={s.studioName} logo={logo} logoLight={logoLight} user={user ? { name: user.name, role: user.role } : null} />
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <SiteFooter s={s} logo={logo} logoLight={logoLight} />
      <WhatsAppFab number={s.whatsapp} studioName={s.studioName} />
      {demo && (
        <p role="note" className="fixed bottom-5 left-4 z-40 max-w-[calc(100vw-7rem)] rounded-full bg-amber-100/95 px-4 py-2 text-xs font-medium text-amber-900 shadow-lg ring-1 ring-amber-300 backdrop-blur">
          <span className="sm:hidden">Conteúdo de demonstração</span>
          <span className="hidden sm:inline">Conteúdo de demonstração — fotos, textos e profissionais de exemplo</span>
        </p>
      )}
    </MotionProvider>
  );
}
