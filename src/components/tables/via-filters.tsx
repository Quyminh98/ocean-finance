"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Base UI's Select needs a defined item value for "no filter" — same reasoning as page-filters.tsx.
const ALL_SENTINEL = "all";

type ViaFilterOption = { id: string; name: string };

type ViaFiltersProps = {
  holderOptions: ViaFilterOption[];
};

/** "Người cầm" filter for the Admin-only global Via list (user request 2026-08-21), URL-synced
 * (`holderUserId` param) — same pattern as `PageFilters`. */
export function ViaFilters({ holderOptions }: ViaFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const holderUserId = searchParams.get("holderUserId") ?? ALL_SENTINEL;

  const holderLabels: Record<string, string> = { [ALL_SENTINEL]: "Tất cả người cầm" };
  for (const option of holderOptions) holderLabels[option.id] = option.name;

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL_SENTINEL) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={holderUserId} onValueChange={(value) => setParam("holderUserId", value)}>
      <SelectTrigger className="h-9 rounded-lg">
        <SelectValue>{(value: string | null) => (value ? (holderLabels[value] ?? value) : "Tất cả người cầm")}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_SENTINEL}>Tất cả người cầm</SelectItem>
        {holderOptions.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
