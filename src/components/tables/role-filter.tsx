"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Base UI's Select needs a defined item value for "no filter" — same reasoning as audit-filters.tsx.
const ALL_SENTINEL = "all";

const ROLE_LABELS: Record<string, string> = {
  [ALL_SENTINEL]: "Tất cả vai trò",
  ADMIN: "Admin",
  USER: "Nhân viên",
};

/** Role filter (ADMIN/USER) for Settings — User Accounts list, URL-synced (spec §13). */
export function RoleFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") ?? ALL_SENTINEL;

  function handleChange(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL_SENTINEL) {
      params.delete("role");
    } else {
      params.set("role", value);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={role} onValueChange={handleChange}>
      <SelectTrigger className="h-9 rounded-lg">
        <SelectValue>{(value: string | null) => (value ? (ROLE_LABELS[value] ?? value) : ROLE_LABELS[ALL_SENTINEL])}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(ROLE_LABELS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
