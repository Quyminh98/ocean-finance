"use client";

import { Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuditActionChip, AuditActorTypeChip } from "@/components/tables/audit-badges";
import { auditEntityLabel } from "@/lib/audit-labels";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { AuditActorType } from "@/generated/prisma/client";

type AuditDetailDialogProps = {
  actorType: AuditActorType;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: unknown;
  afterJson: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string;
  createdAt: Date;
};

/** Flattens a JSON object's scalar/nested fields into displayable strings; non-object values collapse to a single "value" row. */
function flattenJson(value: unknown): Record<string, string> {
  if (value === null || value === undefined || typeof value !== "object") {
    return value === null || value === undefined ? {} : { value: String(value) };
  }
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === null || raw === undefined) result[key] = "—";
    else if (typeof raw === "object") result[key] = JSON.stringify(raw);
    else result[key] = String(raw);
  }
  return result;
}

/** Before/After diff table (spec §29 example: "Before: 20.000.000 / After: 25.000.000"). */
function AuditDiffTable({ before, after }: { before: unknown; after: unknown }) {
  const isCreate = before === null || before === undefined;
  const isDelete = after === null || after === undefined;
  const beforeFlat = flattenJson(before);
  const afterFlat = flattenJson(after);
  const keys = Array.from(new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)])).sort();

  if (keys.length === 0) {
    return <p className="font-body-md text-body-md text-on-surface-variant">Không có dữ liệu before/after.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-surface-ice">
            <th className="px-3 py-2 font-label-caps text-label-caps text-on-surface-variant">Trường</th>
            <th className="px-3 py-2 font-label-caps text-label-caps text-on-surface-variant">Trước</th>
            <th className="px-3 py-2 font-label-caps text-label-caps text-on-surface-variant">Sau</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const beforeValue = beforeFlat[key] ?? "—";
            const afterValue = afterFlat[key] ?? "—";
            const changed = !isCreate && !isDelete && beforeValue !== afterValue;
            return (
              <tr key={key} className="border-t border-border-subtle">
                <td className="px-3 py-2 font-body-md text-body-md text-on-surface-variant">{key}</td>
                <td className="px-3 py-2 font-data-tabular text-data-tabular text-on-surface-variant">
                  {isCreate ? "—" : beforeValue}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 font-data-tabular text-data-tabular",
                    changed ? "font-semibold text-success-green" : "text-on-surface-variant",
                  )}
                >
                  {isDelete ? "—" : afterValue}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AuditDetailDialog({
  actorType,
  actorName,
  actorEmail,
  action,
  entityType,
  entityId,
  beforeJson,
  afterJson,
  ipAddress,
  userAgent,
  requestId,
  createdAt,
}: AuditDetailDialogProps) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm">
            <Eye />
            <span className="sr-only">Xem chi tiết</span>
          </Button>
        }
      />
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-stack-sm font-headline-sm text-headline-sm">
            <AuditActionChip action={action} />
            <span className="text-on-surface-variant">{auditEntityLabel(entityType)}</span>
          </DialogTitle>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-body-md text-body-md">
          <dt className="text-on-surface-variant">Thời gian</dt>
          <dd className="font-data-tabular text-data-tabular text-on-surface">{formatDateTime(createdAt)}</dd>

          <dt className="text-on-surface-variant">Người thực hiện</dt>
          <dd className="flex items-center gap-1.5 text-on-surface">
            <AuditActorTypeChip actorType={actorType} />
            <span>{actorName ?? "—"}</span>
          </dd>

          {actorEmail ? (
            <>
              <dt className="text-on-surface-variant">Email</dt>
              <dd className="text-on-surface">{actorEmail}</dd>
            </>
          ) : null}

          <dt className="text-on-surface-variant">Entity ID</dt>
          <dd className="break-all font-data-tabular text-data-tabular text-on-surface">{entityId}</dd>

          <dt className="text-on-surface-variant">Request ID</dt>
          <dd className="break-all font-data-tabular text-data-tabular text-on-surface">{requestId}</dd>

          {ipAddress ? (
            <>
              <dt className="text-on-surface-variant">IP</dt>
              <dd className="font-data-tabular text-data-tabular text-on-surface">{ipAddress}</dd>
            </>
          ) : null}

          {userAgent ? (
            <>
              <dt className="text-on-surface-variant">User Agent</dt>
              <dd className="break-all text-on-surface-variant">{userAgent}</dd>
            </>
          ) : null}
        </dl>

        <AuditDiffTable before={beforeJson} after={afterJson} />
      </DialogContent>
    </Dialog>
  );
}
