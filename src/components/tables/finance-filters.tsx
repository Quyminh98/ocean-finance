"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type FilterOption = { id: string; name: string };

// Base UI's Select needs a defined item value for "no filter" — "" can't
// represent unset (same reasoning as page.schema.ts NO_EMPLOYEE_SENTINEL).
const ALL_SENTINEL = "all";

type FinanceFiltersProps = {
  employeeOptions: FilterOption[];
  pageOptions: FilterOption[];
};

/**
 * Month/Employee/Page filter row, URL-synced (spec §13). Reused by Revenue
 * (Phase 5) and Ads (Phase 6) — same filter set per spec §18.
 *
 * Query param for the Page filter is named `pageId`, not `page` — spec §13's
 * example (`?month=...&employee=...&page=...`) collides with the existing
 * pagination `page` (page NUMBER) param already used across every list
 * screen, so this deviates from the literal spec example to avoid that clash.
 */
export function FinanceFilters({ employeeOptions, pageOptions }: FinanceFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const month = searchParams.get("month") ?? "";
  const employee = searchParams.get("employee") ?? ALL_SENTINEL;
  const pageId = searchParams.get("pageId") ?? ALL_SENTINEL;

  const employeeLabels: Record<string, string> = { [ALL_SENTINEL]: "Tất cả nhân viên" };
  for (const option of employeeOptions) employeeLabels[option.id] = option.name;

  const pageLabels: Record<string, string> = { [ALL_SENTINEL]: "Tất cả Page" };
  for (const option of pageOptions) pageLabels[option.id] = option.name;

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
      <Input
        type="month"
        value={month}
        onChange={(event) => setParam("month", event.target.value)}
        className="h-9 w-auto rounded-lg"
      />
      <Select value={employee} onValueChange={(value) => setParam("employee", value)}>
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
      <Select value={pageId} onValueChange={(value) => setParam("pageId", value)}>
        <SelectTrigger className="h-9 rounded-lg">
          <SelectValue>{(value: string | null) => (value ? (pageLabels[value] ?? value) : "Tất cả Page")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SENTINEL}>Tất cả Page</SelectItem>
          {pageOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
