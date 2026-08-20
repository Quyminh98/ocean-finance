import { HandCoins, Megaphone, FilePlus, ArrowLeftRight, Wallet, Receipt } from "lucide-react";
import type { ActivityFeedItem } from "@/server/services/dashboard.service";
import { formatRelativeTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

const activityIcon = {
  REVENUE: HandCoins,
  ADS: Megaphone,
  PAGE_NEW: FilePlus,
  PAGE_TRANSFER: ArrowLeftRight,
  ADMIN_EXPENSE: Wallet,
  ADMIN_RECEIPT: Receipt,
} as const;

const activityTone: Record<keyof typeof activityIcon, string> = {
  REVENUE: "bg-surface-ice text-finance-blue",
  ADS: "bg-error-container/30 text-error-red",
  PAGE_NEW: "bg-surface-container text-on-surface-variant",
  PAGE_TRANSFER: "bg-surface-container text-on-surface-variant",
  ADMIN_EXPENSE: "bg-secondary-container/50 text-secondary",
  ADMIN_RECEIPT: "bg-surface-ice text-success-green",
};

export function RecentActivity({ items }: { items: ActivityFeedItem[] }) {
  if (items.length === 0) {
    return <p className="font-body-md text-body-md text-on-surface-variant">Chưa có hoạt động nào.</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const Icon = activityIcon[item.type];
        return (
          <div key={item.id} className="flex gap-3">
            <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", activityTone[item.type])}>
              <Icon className="size-4" strokeWidth={2} />
            </div>
            <div>
              <p className="font-body-md text-body-md text-on-surface">{item.message}</p>
              <p className="mt-1 font-label-caps text-[10px] text-outline">{formatRelativeTime(item.occurredAt)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
