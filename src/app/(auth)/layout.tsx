import Link from "next/link";
import { getSettings } from "@/server/settings";
import { mediaUrl } from "@/lib/media-url";
import { Wordmark } from "@/components/site/wordmark";
import { SwatchArt } from "@/components/site/swatch";
import { Photo } from "@/components/site/photo";
import { MotionProvider } from "@/components/motion/primitives";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const s = await getSettings();
  const img = mediaUrl(s.heroImageId);
  return (
    <MotionProvider>
      <div className="grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <aside className="grain relative hidden overflow-hidden bg-petrol text-white lg:block">
          {img ? <Photo src={img} alt="" className="absolute inset-0 h-full w-full opacity-45" sizes="45vw" /> : <SwatchArt className="absolute inset-0 opacity-70" />}
          <div className="absolute inset-0 bg-gradient-to-b from-[#052f32]/70 via-[#052f32]/30 to-[#340b17]/90" />
          <div className="relative flex h-full flex-col justify-between p-12">
            <Link href="/" aria-label="Voltar ao site">
              <Wordmark name={s.studioName} logo={mediaUrl(s.logoId)} tone="light" />
            </Link>
            <p className="display max-w-md text-[3.4rem] leading-[0.98]">
              Seu horário, <span className="italic text-[#f3b6c0]">do seu jeito.</span>
            </p>
          </div>
        </aside>
        <main className="flex min-h-svh flex-col bg-paper px-5 py-8 sm:px-10">
          <div className="lg:hidden">
            <Link href="/" aria-label="Voltar ao site">
              <Wordmark name={s.studioName} logo={mediaUrl(s.logoId)} />
            </Link>
          </div>
          <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-10">{children}</div>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/privacidade" className="underline underline-offset-2">Privacidade</Link> ·{" "}
            <Link href="/termos" className="underline underline-offset-2">Termos de uso</Link>
          </p>
        </main>
      </div>
    </MotionProvider>
  );
}
