import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Instrument_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { getSettings } from "@/server/settings";
import { appUrl } from "@/lib/env";
import "./globals.css";

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

// Conteúdo vem do banco (administrável): sempre renderizado sob demanda
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(appUrl()),
    title: { default: `${s.studioName} — ${s.tagline}`, template: `%s · ${s.studioName}` },
    description: s.heroSubtitle,
    openGraph: { type: "website", locale: "pt_BR", siteName: s.studioName, title: s.studioName, description: s.heroSubtitle },
  };
}

export const viewport: Viewport = {
  themeColor: "#052f32",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${bodoni.variable} ${instrument.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
