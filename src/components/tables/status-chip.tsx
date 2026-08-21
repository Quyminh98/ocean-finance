import { cn } from "@/lib/utils";

type StatusTone = "success" | "neutral" | "error";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-surface-ice text-success-green",
  neutral: "bg-surface-container text-on-surface-variant",
  error: "bg-error-container text-error-red",
};

const statusTone: Record<string, StatusTone> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  ARCHIVED: "neutral",
  REVOKED: "error",
  // PayoutStatus (user request 2026-08-20) — "đang hoạt động thì màu xanh, có vấn đề thì màu đỏ".
  ISSUE: "error",
};

const statusLabel: Record<string, string> = {
  ACTIVE: "Hoạt động",
  INACTIVE: "Ngừng hoạt động",
  ARCHIVED: "Lưu trữ",
  REVOKED: "Đã thu hồi",
  ISSUE: "Có vấn đề",
};

/** Small uppercase label per DESIGN.md "Status Chips". */
export function StatusChip({ status }: { status: string }) {
  const tone = statusTone[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 font-label-caps text-label-caps uppercase",
        toneClasses[tone],
      )}
    >
      {statusLabel[status] ?? status}
    </span>
  );
}
