import { cn } from "@/lib/utils";
import { pageStatusChipClass } from "@/lib/page-status-colors";
import type { PageStatusColorValue } from "@/server/validators/page-status-option.schema";

type PageStatusChipProps = {
  status: { label: string; color: PageStatusColorValue } | null;
};

/**
 * Page.statusId, resolved to its PageStatusOption (user request 2026-08-18).
 * Deviates from DESIGN.md "Status Chips" (small, uppercase) by user request
 * 2026-08-18 — sentence case + bold reads better for free-typed labels than
 * DESIGN.md's uppercase-label convention (built for short fixed enum values
 * like ACTIVE/ARCHIVED). Scoped to this component only — the shared
 * `StatusChip` (User) keeps the original uppercase style.
 */
export function PageStatusChip({ status }: PageStatusChipProps) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 font-label-caps text-label-caps font-bold bg-surface-container text-outline">
        Chưa đặt
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 font-label-caps text-label-caps font-bold",
        pageStatusChipClass(status.color),
      )}
    >
      {status.label}
    </span>
  );
}
