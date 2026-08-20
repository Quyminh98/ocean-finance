import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusChip } from "@/components/tables/status-chip";
import { SearchInput } from "@/components/tables/search-input";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditEmployeeDialog } from "@/components/forms/edit-employee-dialog";
import { DeactivateEmployeeButton } from "@/components/forms/deactivate-employee-button";
import { SettleProfitButton } from "@/components/forms/settle-profit-button";
import { formatVnd, REVENUE_TEXT_CLASS, EXPENSE_TEXT_CLASS, profitTextClass } from "@/lib/money";
import { listEmployees, EMPLOYEE_PAGE_SIZE_OPTIONS, type EmployeePageSize } from "@/server/services/employee.service";

type EmployeesSearchParams = { q?: string; page?: string; pageSize?: string };

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<EmployeesSearchParams>;
}) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, Number(params.page) || 1) : 1;
  const pageSizeCandidate = params.pageSize ? Number(params.pageSize) : 20;
  const pageSize: EmployeePageSize = (EMPLOYEE_PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeCandidate)
    ? (pageSizeCandidate as EmployeePageSize)
    : 20;

  // Always all-time (user request 2026-08-19) — no month filter on this list anymore.
  const { items, total } = await listEmployees({ search: params.q, page, pageSize });

  return (
    <div>
      <PageHeader
        title="Quản lý Nhân sự"
        description="Danh sách nhân viên, lương hiện hành và Page đang phụ trách."
        action={
          <Button nativeButton={false} render={<Link href="/admin/employees/new" />}>
            <Plus className="size-4" strokeWidth={2} />
            Thêm nhân viên
          </Button>
        }
      />

      <div className="mb-stack-md flex flex-wrap items-center justify-between gap-stack-sm">
        <SearchInput placeholder="Tìm theo tên hoặc email..." />
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={params.q ? "Không tìm thấy nhân viên phù hợp" : "Chưa có nhân viên"}
            description={
              params.q ? "Thử từ khoá khác." : "Bấm “Thêm nhân viên” để tạo hồ sơ đầu tiên."
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-ice hover:bg-surface-ice">
                  <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tên</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Email</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Page đang quản lý</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Doanh thu</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Tổng chi phí</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Lợi nhuận</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Trạng thái</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((employee, index) => {
                  // Employee Cost (employee.totalCost) already bakes in every
                  // past settlement (spec §10.2, `getEmployeeFinancials`) —
                  // no separate settled-total lookup needed anymore.
                  const currentProfit = employee.revenue - employee.totalCost;
                  return (
                    <TableRow key={employee.employeeId} className="border-border-subtle">
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{(page - 1) * pageSize + index + 1}</TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/employees/${employee.employeeId}`}
                          className="font-medium text-on-surface hover:text-finance-blue"
                        >
                          {employee.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-on-surface-variant">{employee.email}</TableCell>
                      <TableCell className="text-right font-data-tabular text-data-tabular">{employee.activePages}</TableCell>
                      <TableCell className={`text-right font-data-tabular text-data-tabular ${REVENUE_TEXT_CLASS}`}>{formatVnd(employee.revenue)}</TableCell>
                      <TableCell className={`text-right font-data-tabular text-data-tabular ${EXPENSE_TEXT_CLASS}`}>{formatVnd(employee.totalCost)}</TableCell>
                      <TableCell className={`text-right font-data-tabular text-data-tabular ${profitTextClass(currentProfit)}`}>{formatVnd(currentProfit)}</TableCell>
                      <TableCell>
                        <StatusChip status={employee.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-stack-sm">
                          {currentProfit > 0n ? (
                            <SettleProfitButton
                              employeeId={employee.employeeId}
                              employeeName={employee.name}
                              currentProfit={currentProfit}
                            />
                          ) : null}
                          <EditEmployeeDialog
                            employeeId={employee.employeeId}
                            defaultValues={{ name: employee.name, email: employee.email, status: employee.status }}
                          />
                          {employee.status === "ACTIVE" ? (
                            <DeactivateEmployeeButton employeeId={employee.employeeId} employeeName={employee.name} />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} pageSizeOptions={EMPLOYEE_PAGE_SIZE_OPTIONS} />
          </>
        )}
      </div>
    </div>
  );
}
