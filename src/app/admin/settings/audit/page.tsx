import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/tables/pagination";
import { AuditFilters } from "@/components/tables/audit-filters";
import { AuditDetailDialog } from "@/components/tables/audit-detail-dialog";
import { AuditActionChip, AuditActorTypeChip } from "@/components/tables/audit-badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditEntityLabel } from "@/lib/audit-labels";
import { formatDateTime } from "@/lib/dates";
import {
  listAuditLogs,
  listAuditFilterOptions,
  AUDIT_PAGE_SIZE_OPTIONS,
  type AuditPageSize,
} from "@/server/services/audit.service";

type AuditSearchParams = {
  page?: string;
  pageSize?: string;
  entityType?: string;
  action?: string;
  actorUserId?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<AuditSearchParams> }) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, Number(params.page) || 1) : 1;
  const pageSizeCandidate = params.pageSize ? Number(params.pageSize) : 20;
  const pageSize: AuditPageSize = (AUDIT_PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeCandidate)
    ? (pageSizeCandidate as AuditPageSize)
    : 20;

  const [{ items, total }, filterOptions] = await Promise.all([
    listAuditLogs({
      entityType: params.entityType,
      action: params.action,
      actorUserId: params.actorUserId,
      entityId: params.entityId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page,
      pageSize,
    }),
    listAuditFilterOptions(),
  ]);

  const hasActiveFilter = Boolean(
    params.entityType || params.action || params.actorUserId || params.entityId || params.dateFrom || params.dateTo,
  );

  return (
    <div>
      <PageHeader title="Audit Log" description="Nhật ký append-only cho mọi thao tác ghi dữ liệu, từ Web lẫn MCP." />

      <div className="mb-stack-md">
        <AuditFilters
          entityTypeOptions={filterOptions.entityTypes}
          actionOptions={filterOptions.actions}
          actorOptions={filterOptions.actors}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {items.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={hasActiveFilter ? "Không tìm thấy nhật ký phù hợp" : "Chưa có nhật ký"}
            description={
              hasActiveFilter
                ? "Thử điều chỉnh bộ lọc."
                : "Audit log sẽ hiển thị tại đây sau khi các hành động ghi dữ liệu được thực hiện."
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-ice hover:bg-surface-ice">
                  <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Thời gian</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Người thực hiện</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Hành động</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Đối tượng</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Entity ID</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Chi tiết</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, index) => (
                  <TableRow key={row.id} className="border-border-subtle">
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="whitespace-nowrap font-data-tabular text-data-tabular text-on-surface-variant">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-stack-sm">
                        <AuditActorTypeChip actorType={row.actorType} />
                        <span className="font-body-md text-body-md text-on-surface">{row.actorName ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <AuditActionChip action={row.action} />
                    </TableCell>
                    <TableCell className="text-on-surface-variant">{auditEntityLabel(row.entityType)}</TableCell>
                    <TableCell
                      className="font-data-tabular text-data-tabular text-on-surface-variant"
                      title={row.entityId}
                    >
                      {row.entityId.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="text-right">
                      <AuditDetailDialog
                        actorType={row.actorType}
                        actorName={row.actorName}
                        actorEmail={row.actorEmail}
                        action={row.action}
                        entityType={row.entityType}
                        entityId={row.entityId}
                        beforeJson={row.beforeJson}
                        afterJson={row.afterJson}
                        ipAddress={row.ipAddress}
                        userAgent={row.userAgent}
                        requestId={row.requestId}
                        createdAt={row.createdAt}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} pageSizeOptions={AUDIT_PAGE_SIZE_OPTIONS} />
          </>
        )}
      </div>
    </div>
  );
}
