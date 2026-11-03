import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando">
      <Skeleton className="h-11 w-64 rounded-2xl" />
      <Skeleton className="mt-3 h-4 w-full max-w-lg rounded-full" />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <Skeleton className="mt-6 h-80 w-full rounded-2xl" />
    </div>
  );
}
