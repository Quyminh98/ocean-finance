import { Skeleton } from "@/components/ui/skeleton";

export default function UserProfileLoading() {
  return (
    <div>
      <Skeleton className="mb-2 h-8 w-40" />
      <Skeleton className="mb-stack-md h-4 w-72" />
      <div className="max-w-md space-y-stack-md rounded-lg border border-border-subtle bg-surface-container-lowest p-card-padding">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
