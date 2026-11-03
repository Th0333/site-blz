"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[70svh] place-items-center bg-paper px-6 pt-24 text-center">
      <div>
        <p className="eyebrow text-merlot">Algo saiu do lugar</p>
        <h1 className="display mt-4 text-[clamp(2.6rem,7vw,4.6rem)] text-petrol">Não conseguimos carregar esta página</h1>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">Tente novamente. Se o problema continuar, fale com o estúdio pelo WhatsApp.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={reset}>Tentar novamente</Button>
          <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>Ir para o início</Link>
        </div>
      </div>
    </main>
  );
}
