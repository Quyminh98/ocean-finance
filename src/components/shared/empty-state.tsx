import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

/** Shared empty state for tables/cards — spec §40 "Empty state rõ ràng". */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-stack-sm rounded-lg border border-dashed border-border-subtle bg-surface-container-low/50 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-surface-container text-outline">
        <Icon className="size-5" strokeWidth={2} />
      </div>
      <p className="font-headline-sm text-headline-sm text-on-surface">{title}</p>
      {description ? (
        <p className="max-w-sm font-body-md text-body-md text-on-surface-variant">{description}</p>
      ) : null}
      {action ? <div className="mt-stack-sm">{action}</div> : null}
    </div>
  );
}
