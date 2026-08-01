import { Skeleton } from '@/components/ui/skeleton';

function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28 bg-stone-200" />
        <Skeleton className="h-8 w-72 max-w-full bg-stone-200" />
        <Skeleton className="h-3 w-96 max-w-full bg-stone-200" />
      </div>
      <Skeleton className="h-10 w-32 bg-stone-200" />
    </div>
  );
}

function StatCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="rounded-2xl border border-stone-200 bg-white p-5">
          <Skeleton className="h-10 w-10 rounded-xl bg-stone-200" />
          <Skeleton className="mt-5 h-7 w-20 bg-stone-200" />
          <Skeleton className="mt-3 h-3 w-28 bg-stone-200" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-stone-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40 bg-stone-200" />
          <Skeleton className="h-3 w-64 max-w-full bg-stone-200" />
        </div>
        <Skeleton className="h-10 w-full bg-stone-200 sm:w-56" />
      </div>
      <div className="space-y-3 p-5">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <Skeleton key={item} className="h-14 w-full bg-stone-200" />
        ))}
      </div>
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <Skeleton className="h-11 w-11 rounded-xl bg-stone-200" />
            <Skeleton className="h-6 w-20 bg-stone-200" />
          </div>
          <Skeleton className="mt-5 h-5 w-3/4 bg-stone-200" />
          <Skeleton className="mt-3 h-3 w-full bg-stone-200" />
          <Skeleton className="mt-2 h-3 w-2/3 bg-stone-200" />
          <Skeleton className="mt-6 h-9 w-full bg-stone-200" />
        </div>
      ))}
    </div>
  );
}

export function SectionLoadingSkeleton({ label = 'Loading content', rows = 4 }) {
  return (
    <div className="space-y-3 py-3" role="status" aria-live="polite" aria-busy="true">
      {Array.from({ length: rows }, (_, item) => (
        <Skeleton key={item} className="h-14 w-full bg-stone-200" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default function PageLoadingSkeleton({
  label = 'Loading page',
  variant = 'table',
  showStats = false,
}) {
  return (
    <div className="space-y-6 py-2" role="status" aria-live="polite" aria-busy="true">
      <PageHeaderSkeleton />
      {showStats || variant === 'dashboard' ? <StatCardsSkeleton /> : null}
      {variant === 'cards' ? <CardsSkeleton /> : <TableSkeleton />}
      <span className="sr-only">{label}</span>
    </div>
  );
}
