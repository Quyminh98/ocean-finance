import Link from "next/link";
import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusChip } from "@/components/tables/status-chip";
import { SearchInput } from "@/components/tables/search-input";
import { Pagination } from "@/components/tables/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SetSalaryDialog } from "@/components/forms/set-salary-dialog";
import { formatVnd, EXPENSE_TEXT_CLASS } from "@/lib/money";
import { listEmployeeSalaries, SALARY_PAGE_SIZE_OPTIONS, type SalaryPageSize } from "@/server/services/salary.service";
import { listAdminOptions } from "@/server/services/user-account.service";

type SalarySearchParams = { q?: string; page?: string; pageSize?: string };

export default async function SalaryPage({ searchParams }: { searchParams: Promise<SalarySearchParams> }) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, Number(params.page) || 1) : 1;
  const pageSizeCandidate = params.pageSize ? Number(params.pageSize) : 20;
  const pageSize: SalaryPageSize = (SALARY_PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeCandidate)
    ? (pageSizeCandidate as SalaryPageSize)
    : 20;

  const [{ items, total }, adminOptions] = await Promise.all([
    listEmployeeSalaries({ search: params.q, page, pageSize }),
    listAdminOptions(),
  ]);

  return (
    <div>
      <PageHeader
        title="Lương"
        description="Nhập mức lương hiện tại của từng nhân viên — một con số cố định, không phải giao dịch phát sinh hàng tháng."
      />

      <div className="mb-stack-md flex flex-wrap items-center justify-between gap-stack-sm">
        <SearchInput placeholder="Tìm theo tên hoặc email..." />
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {items.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title={params.q ? "Không tìm thấy nhân viên phù hợp" : "Chưa có nhân viên"}
            description={params.q ? "Thử từ khoá khác." : "Thêm nhân viên ở mục Nhân sự trước khi thiết lập lương."}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-ice hover:bg-surface-ice">
                  <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tên</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Email</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Lương</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Người chi</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Trạng thái</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, index) => (
                  <TableRow key={row.employeeId} className="border-border-subtle">
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/employees/${row.employeeId}`}
                        className="font-medium text-on-surface hover:text-finance-blue"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-on-surface-variant">{row.email}</TableCell>
                    <TableCell className={`text-right font-data-tabular text-data-tabular ${EXPENSE_TEXT_CLASS}`}>
                      {formatVnd(row.currentSalary)}
                    </TableCell>
                    <TableCell className="font-medium text-on-surface">{row.currentPaidByAdminName ?? "—"}</TableCell>
                    <TableCell>
                      <StatusChip status={row.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <SetSalaryDialog
                          employeeId={row.employeeId}
                          currentSalary={row.currentSalary}
                          currentEffectiveFrom={row.currentEffectiveFrom}
                          adminOptions={adminOptions}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} pageSizeOptions={SALARY_PAGE_SIZE_OPTIONS} />
          </>
        )}
      </div>
    </div>
  );
}
