import { cn } from "@/lib/utils";
import type { Role } from "@/generated/prisma/client";

const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", USER: "Nhân viên" };
const ROLE_TONE: Record<Role, string> = {
  ADMIN: "bg-surface-ice text-finance-blue",
  USER: "bg-surface-container text-on-surface-variant",
};

/** Same visual language as StatusChip (DESIGN.md "Status Chips"), keyed on User.role instead of status. */
export function RoleChip({ role }: { role: Role }) {
  return (
    <span className={cn("inline-flex items-center rounded px-2 py-0.5 font-label-caps text-label-caps uppercase", ROLE_TONE[role])}>
      {ROLE_LABEL[role]}
    </span>
  );
}
