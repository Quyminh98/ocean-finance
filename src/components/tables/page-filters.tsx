"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_TYPES } from "@/server/validators/page.schema";

// Base UI's Select needs a defined item value for "no filter" — same reasoning as finance-filters.tsx.
const ALL_SENTINEL = "all";

const PAGE_TYPE_FILTER_LABEL: Record<(typeof PAGE_TYPES)[number], string> = { SYSTEM: "Hệ thống", BKT: "BKT" };

type FilterOption = { id: string; name: string };

type PageFiltersProps = {
  statusOptions: FilterOption[];
  /** Omit on `/user/pages` — "Nhân viên phụ trách" is meaningless there, the list is already scoped to the caller. */
  employeeOptions?: FilterOption[];
};

/** Loại Page / Trạng thái / (Admin-only) Nhân viên phụ trách filter row for `/admin/pages` + `/user/pages` (user request 2026-08-18), URL-synced. */
export function PageFilters({ statusOptions, employeeOptions }: PageFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pageType = searchParams.get("pageType") ?? ALL_SENTINEL;
  const statusId = searchParams.get("statusId") ?? ALL_SENTINEL;
  const employeeId = searchParams.get("employeeId") ?? ALL_SENTINEL;

  const statusLabels: Record<string, string> = { [ALL_SENTINEL]: "Tất cả trạng thái" };
  for (const option of statusOptions) statusLabels[option.id] = option.name;

  const employeeLabels: Record<string, string> = { [ALL_SENTINEL]: "Tất cả nhân viên" };
  for (const option of employeeOptions ?? []) employeeLabels[option.id] = option.name;

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL_SENTINEL) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-stack-sm">
      <Select value={pageType} onValueChange={(value) => setParam("pageType", value)}>
        <SelectTrigger className="h-9 rounded-lg">
          <SelectValue>{(value: string | null) => (value ? (PAGE_TYPE_FILTER_LABEL[value as (typeof PAGE_TYPES)[number]] ?? value) : "Tất cả loại")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SENTINEL}>Tất cả loại</SelectItem>
          {PAGE_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {PAGE_TYPE_FILTER_LABEL[type]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusId} onValueChange={(value) => setParam("statusId", value)}>
        <SelectTrigger className="h-9 rounded-lg">
          <SelectValue>{(value: string | null) => (value ? (statusLabels[value] ?? value) : "Tất cả trạng thái")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SENTINEL}>Tất cả trạng thái</SelectItem>
          {statusOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {employeeOptions ? (
        <Select value={employeeId} onValueChange={(value) => setParam("employeeId", value)}>
          <SelectTrigger className="h-9 rounded-lg">
            <SelectValue>{(value: string | null) => (value ? (employeeLabels[value] ?? value) : "Tất cả nhân viên")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>Tất cả nhân viên</SelectItem>
            {employeeOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
