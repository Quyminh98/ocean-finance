import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton rows for a Clean Table while data is loading. */
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-border-subtle">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-gutter px-4 py-3">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a Data Card (KPI) while loading. */
export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-container-lowest p-card-padding">
      <Skeleton className="mb-stack-md h-3 w-24" />
      <Skeleton className="h-7 w-32" />
    </div>
  );
}

/** Full skeleton for a filterable Clean Table list page (`PageHeader` + search/filter row + table). */
export function ListPageSkeleton({ columns = 6, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <div>
      <div className="mb-stack-md flex flex-wrap items-end justify-between gap-stack-sm">
        <div>
          <Skeleton className="mb-2 h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="mb-stack-md flex flex-wrap items-center justify-between gap-stack-sm">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        <TableSkeleton rows={rows} columns={columns} />
      </div>
    </div>
  );
}

/** Full skeleton for an entity Detail page (`PageHeader` + Summary cards + Tabs). */
export function DetailPageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div>
      <div className="mb-stack-md">
        <Skeleton className="mb-2 h-4 w-16" />
        <Skeleton className="mb-2 h-8 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="mb-gutter grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cards }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
      <div className="mb-stack-md flex gap-stack-md border-b border-border-subtle pb-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        <TableSkeleton rows={5} columns={5} />
      </div>
    </div>
  );
}

/** Simple skeleton for a create/edit form page (`PageHeader` + stacked field placeholders). */
export function FormPageSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div>
      <div className="mb-stack-md">
        <Skeleton className="mb-2 h-4 w-16" />
        <Skeleton className="mb-2 h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="max-w-xl space-y-stack-md">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index}>
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}
