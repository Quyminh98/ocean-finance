import { notFound } from "next/navigation";
import { PiggyBank } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { MonthFilter } from "@/components/tables/month-filter";
import { Pagination } from "@/components/tables/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd, REVENUE_TEXT_CLASS } from "@/lib/money";
import { formatMonth } from "@/lib/dates";
import { requireUser } from "@/server/auth/rbac";
import { getEmployeeDetailByUserId } from "@/server/services/employee.service";
import {
  listEmployeeReceipts,
  EMPLOYEE_RECEIPT_PAGE_SIZE_OPTIONS,
  type EmployeeReceiptPageSize,
} from "@/server/services/employee-receipt.service";

type UserEmployeeReceiptsSearchParams = { page?: string; pageSize?: string; month?: string };

/**
 * Read-only self-service view of `EmployeeReceipt` (user request 2026-08-19)
 * — Admin-only CRUD stays at `/admin/employee-receipts`, this just lists the
 * caller's own rows (`employeeId` always resolved from session, never a
 * client param, same RBAC pattern as `/user/revenue`/`/user/costs`). Purely
 * a record to view — never counted into Revenue/Cost/Profit anywhere
 * (schema.md EmployeeReceipt), so no total/KPI card here either.
 */
export default async function UserEmployeeReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<UserEmployeeReceiptsSearchParams>;
}) {
  const user = await requireUser();
  const profile = await getEmployeeDetailByUserId(user.id);
  if (!profile) notFound();

  const params = await searchParams;
  const page = params.page ? Math.max(1, Number(params.page) || 1) : 1;
  const pageSizeCandidate = params.pageSize ? Number(params.pageSize) : 20;
  const pageSize: EmployeeReceiptPageSize = (EMPLOYEE_RECEIPT_PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeCandidate)
    ? (pageSizeCandidate as EmployeeReceiptPageSize)
    : 20;

  const { items, total } = await listEmployeeReceipts({
    employeeId: profile.employeeId,
    month: params.month,
    page,
    pageSize,
  });
  const hasActiveFilter = Boolean(params.month);

  return (
    <div>
      <PageHeader
        title="Tiền đã nhận của tôi"
        description="Các khoản tiền bạn đã thực nhận, do Admin ghi nhận — không cộng vào Doanh thu/Chi phí của bạn."
      />

      <div className="mb-stack-md flex flex-wrap items-center justify-end gap-stack-sm">
        <MonthFilter />
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {items.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title={hasActiveFilter ? "Không tìm thấy khoản phù hợp" : "Chưa có khoản nào"}
            description={hasActiveFilter ? "Thử điều chỉnh bộ lọc." : "Khoản tiền Admin ghi nhận cho bạn sẽ hiển thị tại đây."}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-ice hover:bg-surface-ice">
                  <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tháng</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Số tiền</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Admin nhập</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, index) => (
                  <TableRow key={row.employeeReceiptId} className="border-border-subtle">
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">
                      {formatMonth(row.receiptMonth.toISOString().slice(0, 7))}
                    </TableCell>
                    <TableCell className={`text-right font-data-tabular text-data-tabular ${REVENUE_TEXT_CLASS}`}>{formatVnd(row.amount)}</TableCell>
                    <TableCell className="text-on-surface-variant">{row.createdByAdminName}</TableCell>
                    <TableCell className="text-on-surface-variant">{row.note ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} pageSizeOptions={EMPLOYEE_RECEIPT_PAGE_SIZE_OPTIONS} />
          </>
        )}
      </div>
    </div>
  );
}
