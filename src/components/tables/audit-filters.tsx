"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/tables/search-input";
import { auditActionLabel, auditEntityLabel } from "@/lib/audit-labels";
import type { AuditActorOption } from "@/server/services/audit.service";

// Base UI's Select needs a defined item value for "no filter" — same reasoning as finance-filters.tsx.
const ALL_SENTINEL = "all";

type AuditFiltersProps = {
  entityTypeOptions: string[];
  actionOptions: string[];
  actorOptions: AuditActorOption[];
};

/** Entity type / action / actor / date range filter row for Audit Log (plan Phase 12), URL-synced (spec §13). */
export function AuditFilters({ entityTypeOptions, actionOptions, actorOptions }: AuditFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const entityType = searchParams.get("entityType") ?? ALL_SENTINEL;
  const action = searchParams.get("action") ?? ALL_SENTINEL;
  const actorUserId = searchParams.get("actorUserId") ?? ALL_SENTINEL;
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  const entityTypeLabels: Record<string, string> = { [ALL_SENTINEL]: "Tất cả đối tượng" };
  for (const option of entityTypeOptions) entityTypeLabels[option] = auditEntityLabel(option);

  const actionLabels: Record<string, string> = { [ALL_SENTINEL]: "Tất cả hành động" };
  for (const option of actionOptions) actionLabels[option] = auditActionLabel(option);

  const actorLabels: Record<string, string> = { [ALL_SENTINEL]: "Tất cả người dùng" };
  for (const option of actorOptions) actorLabels[option.id] = option.name;

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
      <SearchInput paramKey="entityId" placeholder="Tìm theo Entity ID..." />
      <Select value={entityType} onValueChange={(value) => setParam("entityType", value)}>
        <SelectTrigger className="h-9 rounded-lg">
          <SelectValue>{(value: string | null) => (value ? (entityTypeLabels[value] ?? value) : "Tất cả đối tượng")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SENTINEL}>Tất cả đối tượng</SelectItem>
          {entityTypeOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {auditEntityLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={action} onValueChange={(value) => setParam("action", value)}>
        <SelectTrigger className="h-9 rounded-lg">
          <SelectValue>{(value: string | null) => (value ? (actionLabels[value] ?? value) : "Tất cả hành động")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SENTINEL}>Tất cả hành động</SelectItem>
          {actionOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {auditActionLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={actorUserId} onValueChange={(value) => setParam("actorUserId", value)}>
        <SelectTrigger className="h-9 rounded-lg">
          <SelectValue>{(value: string | null) => (value ? (actorLabels[value] ?? value) : "Tất cả người dùng")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SENTINEL}>Tất cả người dùng</SelectItem>
          {actorOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1">
        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => setParam("dateFrom", event.target.value)}
          className="h-9 w-auto rounded-lg"
          aria-label="Từ ngày"
        />
        <span className="text-on-surface-variant">–</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => setParam("dateTo", event.target.value)}
          className="h-9 w-auto rounded-lg"
          aria-label="Đến ngày"
        />
      </div>
    </div>
  );
}
