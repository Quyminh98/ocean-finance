"use client";

import { X } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Single month filter, URL-synced via `?month=` (spec §13). Reused wherever a
 * list only needs the month axis (Employee List, User Revenue) — screens that
 * also need Employee/Page filters use `FinanceFilters` instead.
 */
export function MonthFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const month = searchParams.get("month") ?? "";

  function setMonth(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("month", value);
    } else {
      params.delete("month");
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-stack-sm">
      <Input
        type="month"
        value={month}
        onChange={(event) => setMonth(event.target.value)}
        className="h-9 w-auto rounded-lg"
        aria-label="Lọc theo tháng"
      />
      {month ? (
        <Button variant="ghost" size="sm" onClick={() => setMonth("")}>
          <X className="size-3.5" strokeWidth={2} />
          Xoá lọc
        </Button>
      ) : null}
    </div>
  );
}
