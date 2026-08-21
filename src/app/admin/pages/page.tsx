import Link from "next/link";
import { Plus, FileText, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageStatusChipList } from "@/components/tables/page-status-chip-list";
import { PageTypeChip } from "@/components/tables/page-type-chip";
import { StatusChip } from "@/components/tables/status-chip";
import { SearchInput } from "@/components/tables/search-input";
import { Pagination } from "@/components/tables/pagination";
import { PageFilters } from "@/components/tables/page-filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditPageDialog } from "@/components/forms/edit-page-dialog";
import { DeletePageButton } from "@/components/forms/delete-page-button";
import { TransferPageDialog } from "@/components/forms/transfer-page-dialog";
import { AssignEmployeeDialog } from "@/components/forms/assign-employee-dialog";
import { formatVnd, EXPENSE_TEXT_CLASS } from "@/lib/money";
import { formatMonth } from "@/lib/dates";
import { listPages, PAGES_PAGE_SIZE_OPTIONS, type PagesPageSize } from "@/server/services/page.service";
import { listPageStatusOptions } from "@/server/services/page-status-option.service";
import { listPayouts } from "@/server/services/payout.service";
import { listEmployeeOptions, listActiveEmployeeOptions } from "@/server/services/employee.service";
import { PAGE_TYPES } from "@/server/validators/page.schema";

type PagesSearchParams = { q?: string; page?: string; pageSize?: string; pageType?: string; statusId?: string; employeeId?: string };

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<PagesSearchParams>;
}) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, Number(params.page) || 1) : 1;
  const pageSizeCandidate = params.pageSize ? Number(params.pageSize) : 20;
  const pageSize: PagesPageSize = (PAGES_PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeCandidate)
    ? (pageSizeCandidate as PagesPageSize)
    : 20;
  const pageType = (PAGE_TYPES as readonly string[]).includes(params.pageType ?? "")
    ? (params.pageType as (typeof PAGE_TYPES)[number])
    : undefined;

  const [{ items, total }, statusOptions, payouts, employeeOptions, activeEmployees] = await Promise.all([
    listPages({ search: params.q, pageType, statusId: params.statusId, employeeId: params.employeeId, page, pageSize }),
    listPageStatusOptions(),
    listPayouts(),
    listEmployeeOptions(),
    listActiveEmployeeOptions(),
  ]);
  const statusPickerOptions = statusOptions.map((option) => ({ optionId: option.optionId, label: option.label, color: option.color }));
  const payoutPickerOptions = payouts.map((payout) => ({ payoutId: payout.payoutId, name: payout.name, status: payout.status }));
  const hasActiveFilter = Boolean(params.q || params.pageType || params.statusId || params.employeeId);

  return (
    <div>
      <PageHeader
        title="Quản lý Trang (Pages)"
        description="Toàn bộ Facebook Page, nhân viên phụ trách hiện tại và chi phí mua."
        action={
          <Button nativeButton={false} render={<Link href="/admin/pages/new" />}>
            <Plus className="size-4" strokeWidth={2} />
            Thêm Page
          </Button>
        }
      />

      <div className="mb-stack-md flex flex-wrap items-center justify-between gap-stack-sm">
        <SearchInput placeholder="Tìm theo tên hoặc URL..." />
        <PageFilters
          statusOptions={statusOptions.map((option) => ({ id: option.optionId, name: option.label }))}
          employeeOptions={employeeOptions.map((option) => ({ id: option.employeeId, name: option.name }))}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={hasActiveFilter ? "Không tìm thấy Page phù hợp" : "Chưa có Page"}
            description={hasActiveFilter ? "Thử điều chỉnh bộ lọc hoặc từ khoá." : "Bấm “Thêm Page” để tạo Page đầu tiên."}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-ice hover:bg-surface-ice">
                  <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tên Page</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Loại</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Link</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Nhân viên phụ trách</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Giá mua</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tháng mua</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Trạng thái</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Payout</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, index) => (
                  <TableRow key={row.pageId} className="border-border-subtle">
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell>
                      <Link href={`/admin/pages/${row.pageId}`} className="font-medium text-on-surface hover:text-finance-blue">
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <PageTypeChip pageType={row.pageType} />
                    </TableCell>
                    <TableCell>
                      <a
                        href={row.facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-on-surface-variant hover:text-finance-blue"
                      >
                        <ExternalLink className="size-3.5" strokeWidth={2} />
                        Mở link
                      </a>
                    </TableCell>
                    <TableCell className="text-on-surface-variant">{row.currentEmployeeName ?? "Chưa gán"}</TableCell>
                    <TableCell className={`text-right font-data-tabular text-data-tabular ${EXPENSE_TEXT_CLASS}`}>{formatVnd(row.purchasePrice)}</TableCell>
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{formatMonth(row.purchaseMonth.toISOString().slice(0, 7))}</TableCell>
                    <TableCell>
                      <PageStatusChipList statuses={row.currentStatuses} />
                    </TableCell>
                    <TableCell>
                      {row.payout ? (
                        <div className="flex items-center gap-stack-sm">
                          <span className="text-on-surface-variant">{row.payout.name}</span>
                          <StatusChip status={row.payout.status} />
                        </div>
                      ) : (
                        <span className="text-on-surface-variant">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-stack-sm">
                        <EditPageDialog
                          pageId={row.pageId}
                          defaultValues={{
                            name: row.name,
                            facebookUrl: row.facebookUrl,
                            statusIds: row.currentStatuses.map((status) => status.statusId),
                            payoutId: row.payout?.payoutId ?? "",
                            notes: row.notes ?? "",
                          }}
                          statusOptions={statusPickerOptions}
                          payoutOptions={payoutPickerOptions}
                        />
                        {row.currentEmployeeId ? (
                          <TransferPageDialog
                            pageId={row.pageId}
                            currentEmployeeName={row.currentEmployeeName ?? ""}
                            candidateEmployees={activeEmployees.filter((employee) => employee.employeeId !== row.currentEmployeeId)}
                          />
                        ) : (
                          <AssignEmployeeDialog pageId={row.pageId} candidateEmployees={activeEmployees} />
                        )}
                        <DeletePageButton pageId={row.pageId} pageName={row.name} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} pageSizeOptions={PAGES_PAGE_SIZE_OPTIONS} />
          </>
        )}
      </div>
    </div>
  );
}
