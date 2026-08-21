import Link from "next/link";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/tables/pagination";
import { AdminExpenseFilters } from "@/components/tables/admin-expense-filters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CreateAdminExpenseDialog } from "@/components/forms/create-admin-expense-dialog";
import { EditAdminExpenseDialog } from "@/components/forms/edit-admin-expense-dialog";
import { DeleteAdminExpenseButton } from "@/components/forms/delete-admin-expense-button";
import { RestoreAdminExpenseButton } from "@/components/forms/restore-admin-expense-button";
import { formatVnd, EXPENSE_TEXT_CLASS } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import {
  listAdminExpenses,
  ADMIN_EXPENSE_PAGE_SIZE_OPTIONS,
  type AdminExpensePageSize,
} from "@/server/services/admin-expense.service";
import { listAdminOptions } from "@/server/services/user-account.service";

type AdminExpensesSearchParams = {
  page?: string;
  pageSize?: string;
  month?: string;
  createdByAdminId?: string;
  deleted?: string;
};

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: Promise<AdminExpensesSearchParams>;
}) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, Number(params.page) || 1) : 1;
  const pageSizeCandidate = params.pageSize ? Number(params.pageSize) : 20;
  const pageSize: AdminExpensePageSize = (ADMIN_EXPENSE_PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeCandidate)
    ? (pageSizeCandidate as AdminExpensePageSize)
    : 20;
  const showDeleted = params.deleted === "1";

  const [{ items, total }, adminOptions] = await Promise.all([
    listAdminExpenses({
      month: params.month,
      createdByAdminId: params.createdByAdminId,
      page,
      pageSize,
      deleted: showDeleted,
    }),
    listAdminOptions(),
  ]);

  const hasActiveFilter = Boolean(params.month || params.createdByAdminId);

  const toggleParams = new URLSearchParams();
  if (params.month) toggleParams.set("month", params.month);
  if (params.createdByAdminId) toggleParams.set("createdByAdminId", params.createdByAdminId);
  if (!showDeleted) toggleParams.set("deleted", "1");
  const toggleHref = `/admin/expenses?${toggleParams.toString()}`;

  return (
    <div>
      <PageHeader
        title="Tài nguyên khác"
        description="Chi phí không gắn với Page hoặc nhân viên cụ thể (tool, server, văn phòng...) — chỉ cộng vào Tổng chi phí hệ thống."
        action={!showDeleted ? <CreateAdminExpenseDialog adminOptions={adminOptions} /> : undefined}
      />

      <div className="mb-stack-md flex flex-wrap items-center justify-between gap-stack-sm">
        <AdminExpenseFilters adminOptions={adminOptions.map((a) => ({ id: a.adminId, name: a.name }))} />
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={toggleHref} />}>
          {showDeleted ? "Xem đang hoạt động" : "Xem đã xoá"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {items.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={showDeleted ? "Không có chi phí đã xoá" : hasActiveFilter ? "Không tìm thấy chi phí phù hợp" : "Chưa có tài nguyên nào"}
            description={
              showDeleted
                ? "Chưa có bản ghi nào bị xoá."
                : hasActiveFilter
                  ? "Thử điều chỉnh bộ lọc."
                  : "Bấm “Thêm chi phí” để ghi nhận tài nguyên đầu tiên."
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-ice hover:bg-surface-ice">
                  <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ngày</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Nội dung</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Số tiền</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Người chi</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Admin nhập</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ghi chú</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, index) => (
                  <TableRow key={row.adminExpenseId} className="border-border-subtle">
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">
                      {formatDate(row.expenseDate)}
                    </TableCell>
                    <TableCell className="font-medium text-on-surface">{row.description}</TableCell>
                    <TableCell className={`text-right font-data-tabular text-data-tabular ${EXPENSE_TEXT_CLASS}`}>{formatVnd(row.amount)}</TableCell>
                    <TableCell className="font-medium text-on-surface">{row.paidByAdminName}</TableCell>
                    <TableCell className="text-on-surface-variant">{row.createdByAdminName}</TableCell>
                    <TableCell className="text-on-surface-variant">{row.note ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-stack-sm">
                        {showDeleted ? (
                          <RestoreAdminExpenseButton adminExpenseId={row.adminExpenseId} />
                        ) : (
                          <>
                            <EditAdminExpenseDialog
                              adminExpenseId={row.adminExpenseId}
                              adminOptions={adminOptions}
                              defaultValues={{
                                expenseDate: row.expenseDate.toISOString().slice(0, 10),
                                amount: row.amount.toString(),
                                description: row.description,
                                note: row.note ?? "",
                                paidByAdminId: row.paidByAdminId,
                              }}
                            />
                            <DeleteAdminExpenseButton adminExpenseId={row.adminExpenseId} />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} pageSizeOptions={ADMIN_EXPENSE_PAGE_SIZE_OPTIONS} />
          </>
        )}
      </div>
    </div>
  );
}
