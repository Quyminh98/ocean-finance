import { PageStatusChip } from "@/components/tables/page-status-chip";
import type { PageStatusColorValue } from "@/server/validators/page-status-option.schema";

type PageStatusChipListProps = {
  statuses: { statusId: string; label: string; color: PageStatusColorValue }[];
};

/** A Page can carry several status tags at once (user request 2026-08-18, "chọn nhiều trạng thái được") — wraps PageStatusChip per tag, falls back to the empty state when none are set. */
export function PageStatusChipList({ statuses }: PageStatusChipListProps) {
  if (statuses.length === 0) return <PageStatusChip status={null} />;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {statuses.map((status) => (
        <PageStatusChip key={status.statusId} status={status} />
      ))}
    </div>
  );
}
