import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/tables/search-input";
import { Pagination } from "@/components/tables/pagination";
import { FinanceFilters } from "@/components/tables/finance-filters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateAdExpenseDialog } from "@/components/forms/create-ad-expense-dialog";
import { EditAdExpenseDialog } from "@/components/forms/edit-ad-expense-dialog";
import { DeleteAdExpenseButton } from "@/components/forms/delete-ad-expense-button";
import { formatVnd, EXPENSE_TEXT_CLASS } from "@/lib/money";
import { formatMonth } from "@/lib/dates";
import { listAdExpenses, AD_EXPENSE_PAGE_SIZE_OPTIONS, type AdExpensePageSize } from "@/server/services/ads.service";
import { listEmployeeOptions } from "@/server/services/employee.service";
import { listAdminOptions } from "@/server/services/user-account.service";

type AdsSearchParams = { q?: string; page?: string; pageSize?: string; month?: string; employee?: string };

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<AdsSearchParams>;
}) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, Number(params.page) || 1) : 1;
  const pageSizeCandidate = params.pageSize ? Number(params.pageSize) : 20;
  const pageSize: AdExpensePageSize = (AD_EXPENSE_PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeCandidate)
    ? (pageSizeCandidate as AdExpensePageSize)
    : 20;

  const [{ items, total }, employeeOptions, adminOptions] = await Promise.all([
    listAdExpenses({ search: params.q, month: params.month, employeeId: params.employee, page, pageSize }),
    listEmployeeOptions(),
    listAdminOptions(),
  ]);

  const hasActiveFilter = Boolean(params.q || params.month || params.employee);

  return (
    <div>
      <PageHeader
        title="Quản lý Ads"
        description="Theo dõi và ghi nhận chi phí Ads theo nhân viên."
        action={<CreateAdExpenseDialog employeeOptions={employeeOptions} adminOptions={adminOptions} />}
      />

      <div className="mb-stack-md flex flex-wrap items-center justify-between gap-stack-sm">
        <SearchInput placeholder="Tìm theo tên nhân viên hoặc ghi chú..." />
        <FinanceFilters employeeOptions={employeeOptions.map((e) => ({ id: e.employeeId, name: e.name }))} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {items.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={hasActiveFilter ? "Không tìm thấy chi phí Ads phù hợp" : "Chưa có chi phí Ads"}
            description={hasActiveFilter ? "Thử điều chỉnh bộ lọc hoặc từ khoá." : "Bấm “Thêm chi phí Ads” để ghi nhận chi phí đầu tiên."}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-ice hover:bg-surface-ice">
                  <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Nhân viên</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tháng</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Số tiền</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Người chi</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ghi chú</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, index) => (
                  <TableRow key={row.adExpenseId} className="border-border-subtle">
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="font-medium text-on-surface">{row.employeeName}</TableCell>
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{formatMonth(row.expenseMonth.toISOString().slice(0, 7))}</TableCell>
                    <TableCell className={`text-right font-data-tabular text-data-tabular ${EXPENSE_TEXT_CLASS}`}>{formatVnd(row.amount)}</TableCell>
                    <TableCell className="font-medium text-on-surface">{row.paidByAdminName}</TableCell>
                    <TableCell className="text-on-surface-variant">{row.note ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-stack-sm">
                        <EditAdExpenseDialog
                          adExpenseId={row.adExpenseId}
                          employeeOptions={employeeOptions}
                          adminOptions={adminOptions}
                          defaultValues={{
                            employeeId: row.employeeId,
                            expenseMonth: row.expenseMonth.toISOString().slice(0, 7),
                            amount: row.amount.toString(),
                            note: row.note ?? "",
                            paidByAdminId: row.paidByAdminId,
                          }}
                        />
                        <DeleteAdExpenseButton adExpenseId={row.adExpenseId} employeeId={row.employeeId} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} pageSizeOptions={AD_EXPENSE_PAGE_SIZE_OPTIONS} />
          </>
        )}
      </div>
    </div>
  );
}
