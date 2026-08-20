import { PiggyBank } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/tables/pagination";
import { EmployeeReceiptFilters } from "@/components/tables/employee-receipt-filters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateEmployeeReceiptDialog } from "@/components/forms/create-employee-receipt-dialog";
import { EditEmployeeReceiptDialog } from "@/components/forms/edit-employee-receipt-dialog";
import { DeleteEmployeeReceiptButton } from "@/components/forms/delete-employee-receipt-button";
import { formatVnd, REVENUE_TEXT_CLASS } from "@/lib/money";
import { formatMonth } from "@/lib/dates";
import {
  listEmployeeReceipts,
  EMPLOYEE_RECEIPT_PAGE_SIZE_OPTIONS,
  type EmployeeReceiptPageSize,
} from "@/server/services/employee-receipt.service";
import { listEmployeeOptions } from "@/server/services/employee.service";

type EmployeeReceiptsSearchParams = {
  page?: string;
  pageSize?: string;
  month?: string;
  employeeId?: string;
};

export default async function EmployeeReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<EmployeeReceiptsSearchParams>;
}) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, Number(params.page) || 1) : 1;
  const pageSizeCandidate = params.pageSize ? Number(params.pageSize) : 20;
  const pageSize: EmployeeReceiptPageSize = (EMPLOYEE_RECEIPT_PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeCandidate)
    ? (pageSizeCandidate as EmployeeReceiptPageSize)
    : 20;

  const [{ items, total }, employeeOptions] = await Promise.all([
    listEmployeeReceipts({ month: params.month, employeeId: params.employeeId, page, pageSize }),
    listEmployeeOptions(),
  ]);

  const hasActiveFilter = Boolean(params.month || params.employeeId);

  return (
    <div>
      <PageHeader
        title="Tiền nhân viên đã nhận"
        description="Ghi nhận để xem — không cộng vào Doanh thu/Chi phí của nhân viên hay bất kỳ tính toán nào khác."
        action={<CreateEmployeeReceiptDialog employeeOptions={employeeOptions} />}
      />

      <div className="mb-stack-md flex flex-wrap items-center justify-between gap-stack-sm">
        <EmployeeReceiptFilters employeeOptions={employeeOptions.map((e) => ({ id: e.employeeId, name: e.name }))} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {items.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title={hasActiveFilter ? "Không tìm thấy khoản phù hợp" : "Chưa có khoản nào"}
            description={hasActiveFilter ? "Thử điều chỉnh bộ lọc." : "Bấm “Thêm khoản đã nhận” để ghi nhận khoản đầu tiên."}
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
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Admin nhập</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ghi chú</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, index) => (
                  <TableRow key={row.employeeReceiptId} className="border-border-subtle">
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="font-medium text-on-surface">{row.employeeName}</TableCell>
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">
                      {formatMonth(row.receiptMonth.toISOString().slice(0, 7))}
                    </TableCell>
                    <TableCell className={`text-right font-data-tabular text-data-tabular ${REVENUE_TEXT_CLASS}`}>{formatVnd(row.amount)}</TableCell>
                    <TableCell className="text-on-surface-variant">{row.createdByAdminName}</TableCell>
                    <TableCell className="text-on-surface-variant">{row.note ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-stack-sm">
                        <EditEmployeeReceiptDialog
                          employeeReceiptId={row.employeeReceiptId}
                          employeeOptions={employeeOptions}
                          defaultValues={{
                            employeeId: row.employeeId,
                            receiptMonth: row.receiptMonth.toISOString().slice(0, 7),
                            amount: row.amount.toString(),
                            note: row.note ?? "",
                          }}
                        />
                        <DeleteEmployeeReceiptButton employeeReceiptId={row.employeeReceiptId} />
                      </div>
                    </TableCell>
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
