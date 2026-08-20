import { cn } from "@/lib/utils";
import type { PageType } from "@/generated/prisma/client";

const PAGE_TYPE_LABEL: Record<PageType, string> = { SYSTEM: "Hệ thống", BKT: "BKT" };
const PAGE_TYPE_TONE: Record<PageType, string> = {
  SYSTEM: "bg-surface-ice text-finance-blue",
  BKT: "bg-surface-container text-on-surface-variant",
};

/** Same visual language as RoleChip/StatusChip (DESIGN.md "Status Chips"), keyed on Page.pageType. */
export function PageTypeChip({ pageType }: { pageType: PageType }) {
  return (
    <span className={cn("inline-flex items-center rounded px-2 py-0.5 font-label-caps text-label-caps uppercase", PAGE_TYPE_TONE[pageType])}>
      {PAGE_TYPE_LABEL[pageType]}
    </span>
  );
}
