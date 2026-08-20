"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type FilterOption = { id: string; name: string };

// Base UI's Select needs a defined item value for "no filter" — same reasoning as finance-filters.tsx.
const ALL_SENTINEL = "all";

type AdminExpenseFiltersProps = {
  adminOptions: FilterOption[];
};

/**
 * Month/Admin filter row for Admin Expenses (spec §13, §19) —
 * AdminExpense has no Page/Employee to filter by, so this doesn't reuse
 * `FinanceFilters` (Revenue/Ads) despite the same URL-sync structure.
 */
export function AdminExpenseFilters({ adminOptions }: AdminExpenseFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const month = searchParams.get("month") ?? "";
  const createdByAdminId = searchParams.get("createdByAdminId") ?? ALL_SENTINEL;

  const adminLabels: Record<string, string> = { [ALL_SENTINEL]: "Tất cả Admin" };
  for (const option of adminOptions) adminLabels[option.id] = option.name;

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
      <Select value={createdByAdminId} onValueChange={(value) => setParam("createdByAdminId", value)}>
        <SelectTrigger className="h-9 rounded-lg">
          <SelectValue>{(value: string | null) => (value ? (adminLabels[value] ?? value) : "Tất cả Admin")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SENTINEL}>Tất cả Admin</SelectItem>
          {adminOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
