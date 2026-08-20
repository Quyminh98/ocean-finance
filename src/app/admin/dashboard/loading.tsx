import { CardSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div>
      <Skeleton className="mb-2 h-8 w-64" />
      <Skeleton className="mb-gutter h-4 w-40" />

      <div className="mb-gutter grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>

      <div className="mb-gutter grid grid-cols-1 gap-gutter lg:grid-cols-3">
        <Skeleton className="h-72 rounded-lg lg:col-span-2" />
        <Skeleton className="h-72 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest lg:col-span-2">
          <TableSkeleton rows={5} columns={5} />
        </div>
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
          <TableSkeleton rows={5} columns={2} />
        </div>
      </div>
    </div>
  );
}
