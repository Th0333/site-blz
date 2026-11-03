import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grain grid min-h-svh place-items-center bg-petrol px-6 text-center text-white">
      <div>
        <p className="eyebrow text-teal-haze">Erro 404</p>
        <h1 className="display mt-4 text-[clamp(3rem,9vw,6rem)]">Página <span className="italic text-[#f3b6c0]">não encontrada</span></h1>
        <p className="mx-auto mt-4 max-w-md text-[#cfe0df]">O endereço pode ter mudado ou o conteúdo não está mais disponível.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonVariants({ variant: "light", size: "lg" })}>Voltar ao início</Link>
          <Link href="/agendar" className={buttonVariants({ size: "lg" })}>Agendar horário</Link>
        </div>
      </div>
    </main>
  );
}
