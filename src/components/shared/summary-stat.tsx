import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SummaryStat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-container-lowest p-card-padding">
      <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">{label}</p>
      <p className={cn("mt-stack-sm flex items-center gap-stack-sm font-headline-sm text-headline-sm", tone ?? "text-on-surface")}>{value}</p>
    </div>
  );
}
