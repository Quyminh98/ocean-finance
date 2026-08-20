"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type FilterOption = { id: string; name: string };

// Base UI's Select needs a defined item value for "no filter" — same reasoning as finance-filters.tsx.
const ALL_SENTINEL = "all";

type EmployeeReceiptFiltersProps = {
  employeeOptions: FilterOption[];
};

/** Month/Employee filter row for `/admin/employee-receipts` (user request 2026-08-18), URL-synced. */
export function EmployeeReceiptFilters({ employeeOptions }: EmployeeReceiptFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const month = searchParams.get("month") ?? "";
  const employeeId = searchParams.get("employeeId") ?? ALL_SENTINEL;

  const employeeLabels: Record<string, string> = { [ALL_SENTINEL]: "Tất cả nhân viên" };
  for (const option of employeeOptions) employeeLabels[option.id] = option.name;

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
    </div>
  );
}
