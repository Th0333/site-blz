import { Skeleton } from "@/components/ui/skeleton";

/** Resposta imediata ao navegar: esqueleto da página enquanto o servidor monta o conteúdo. */
export default function Loading() {
  return (
    <div className="bg-paper pb-24 pt-28 sm:pt-36" role="status" aria-label="Carregando">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-10">
        <Skeleton className="h-3 w-32 rounded-full" />
        <Skeleton className="mt-5 h-14 w-full max-w-xl rounded-2xl" />
        <Skeleton className="mt-4 h-5 w-full max-w-md rounded-full" />
        <div className="mt-12 grid gap-5 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <Skeleton className="h-40 w-full rounded-[24px]" />
            <Skeleton className="h-28 w-full rounded-[24px]" />
            <Skeleton className="h-28 w-full rounded-[24px]" />
          </div>
          <Skeleton className="h-72 w-full rounded-[24px] lg:col-span-4" />
        </div>
      </div>
    </div>
  );
}
