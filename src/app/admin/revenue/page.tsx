import Link from "next/link";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/tables/search-input";
import { Pagination } from "@/components/tables/pagination";
import { FinanceFilters } from "@/components/tables/finance-filters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateRevenueDialog } from "@/components/forms/create-revenue-dialog";
import { EditRevenueDialog } from "@/components/forms/edit-revenue-dialog";
import { DeleteRevenueButton } from "@/components/forms/delete-revenue-button";
import { formatVnd, REVENUE_TEXT_CLASS } from "@/lib/money";
import { formatMonth } from "@/lib/dates";
import { listRevenue, REVENUE_PAGE_SIZE_OPTIONS, type RevenuePageSize } from "@/server/services/revenue.service";
import { listPageOptions } from "@/server/services/page.service";
import { listEmployeeOptions } from "@/server/services/employee.service";

type RevenueSearchParams = { q?: string; page?: string; pageSize?: string; month?: string; employee?: string; pageId?: string };

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<RevenueSearchParams>;
}) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, Number(params.page) || 1) : 1;
  const pageSizeCandidate = params.pageSize ? Number(params.pageSize) : 20;
  const pageSize: RevenuePageSize = (REVENUE_PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeCandidate)
    ? (pageSizeCandidate as RevenuePageSize)
    : 20;

  const [{ items, total }, pageOptions, employeeOptions] = await Promise.all([
    listRevenue({ search: params.q, month: params.month, employeeId: params.employee, pageId: params.pageId, page, pageSize }),
    listPageOptions(),
    listEmployeeOptions(),
  ]);

  const hasActiveFilter = Boolean(params.q || params.month || params.employee || params.pageId);

  return (
    <div>
      <PageHeader
        title="Quản lý Doanh thu"
        description="Theo dõi và ghi nhận doanh thu theo Page. Nhân viên phụ trách được tự động xác định."
        action={<CreateRevenueDialog pageOptions={pageOptions} />}
      />

      <div className="mb-stack-md flex flex-wrap items-center justify-between gap-stack-sm">
        <SearchInput placeholder="Tìm theo tên Page hoặc ghi chú..." />
        <FinanceFilters employeeOptions={employeeOptions.map((e) => ({ id: e.employeeId, name: e.name }))} pageOptions={pageOptions.map((p) => ({ id: p.pageId, name: p.name }))} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={hasActiveFilter ? "Không tìm thấy doanh thu phù hợp" : "Chưa có doanh thu"}
            description={hasActiveFilter ? "Thử điều chỉnh bộ lọc hoặc từ khoá." : "Bấm “Thêm doanh thu” để ghi nhận doanh thu đầu tiên."}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-ice hover:bg-surface-ice">
                  <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Page</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Nhân viên</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tháng</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Số tiền</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ghi chú</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, index) => (
                  <TableRow key={row.revenueId} className="border-border-subtle">
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell>
                      <Link href={`/admin/pages/${row.pageId}`} className="font-medium text-on-surface hover:text-finance-blue">
                        {row.pageName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-on-surface-variant">{row.employeeName}</TableCell>
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{formatMonth(row.revenueMonth.toISOString().slice(0, 7))}</TableCell>
                    <TableCell className={`text-right font-data-tabular text-data-tabular ${REVENUE_TEXT_CLASS}`}>{formatVnd(row.amount)}</TableCell>
                    <TableCell className="text-on-surface-variant">{row.note ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-stack-sm">
                        <EditRevenueDialog
                          revenueId={row.revenueId}
                          pageOptions={pageOptions}
                          defaultValues={{
                            pageId: row.pageId,
                            revenueMonth: row.revenueMonth.toISOString().slice(0, 7),
                            amount: row.amount.toString(),
                            note: row.note ?? "",
                          }}
                        />
                        <DeleteRevenueButton revenueId={row.revenueId} pageId={row.pageId} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} pageSizeOptions={REVENUE_PAGE_SIZE_OPTIONS} />
          </>
        )}
      </div>
    </div>
  );
}
