import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt, FileText, Megaphone, ExternalLink, IdCard } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SummaryStat } from "@/components/shared/summary-stat";
import { StatusChip } from "@/components/tables/status-chip";
import { PageStatusChipList } from "@/components/tables/page-status-chip-list";
import { PageTypeChip } from "@/components/tables/page-type-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditEmployeeDialog } from "@/components/forms/edit-employee-dialog";
import { SetSalaryDialog } from "@/components/forms/set-salary-dialog";
import { DeactivateEmployeeButton } from "@/components/forms/deactivate-employee-button";
import { SettleProfitButton } from "@/components/forms/settle-profit-button";
import { MonthlyRevenueChart } from "@/components/dashboard/monthly-revenue-chart";
import { formatVnd, REVENUE_TEXT_CLASS, EXPENSE_TEXT_CLASS, profitTextClass } from "@/lib/money";
import { formatMonth, formatDate } from "@/lib/dates";
import { getEmployeeDetail, getEmployeeFinancials, getEmployeeMonthlySeries } from "@/server/services/employee.service";
import { getSalaryHistory } from "@/server/services/salary.service";
import { listRevenue } from "@/server/services/revenue.service";
import { listAdExpenses } from "@/server/services/ads.service";
import { listPagePurchaseExpensesByEmployee, listPagesByEmployee } from "@/server/services/page.service";
import { listAdminOptions } from "@/server/services/user-account.service";
import { listProfitSettlements } from "@/server/services/profit-settlement.service";
import { listViasByHolder } from "@/server/services/via.service";

type CostDetailRow = {
  key: string;
  /** null for Lương/Bù chi phí rows — not tied to any Page. */
  pageId: string | null;
  pageName: string | null;
  type: "Ads" | "Mua Page" | "Lương" | "Bù chi phí";
  sortDate: Date;
  monthLabel: string;
  amount: bigint;
  /** "—" for Bù chi phí rows — system-computed, no "Người chi" (user request 2026-08-19). */
  paidByAdminName: string;
  note: string | null;
};

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const employee = await getEmployeeDetail(employeeId);
  if (!employee) notFound();

  const [
    salaryHistory,
    financials,
    monthlySeries,
    pages,
    revenue,
    adExpenses,
    pagePurchaseExpenses,
    adminOptions,
    profitSettlements,
    vias,
  ] = await Promise.all([
    getSalaryHistory(employeeId),
    getEmployeeFinancials(employeeId),
    getEmployeeMonthlySeries(employeeId),
    listPagesByEmployee(employeeId),
    listRevenue({ employeeId, pageSize: 20 }),
    listAdExpenses({ employeeId, pageSize: 20 }),
    listPagePurchaseExpensesByEmployee(employeeId),
    listAdminOptions(),
    listProfitSettlements(employeeId),
    listViasByHolder(employee.userId),
  ]);
  const currentSalaryRecord = salaryHistory.find((row) => row.effectiveTo === null) ?? null;
  const adminNameById = new Map(adminOptions.map((option) => [option.adminId, option.name]));

  // Merged Ads + Page Purchase + Lương detail rows (user request 2026-08-18: "gộp bảng vào" /
  // "lương cũng thêm vào phần chi tiết chi phí") — one combined, chronological "Chi tiết chi phí"
  // table instead of separate ones. Lương rows aren't tied to any Page (pageId/pageName null).
  // Chỉ hiện mức lương ĐANG hiệu lực — không hiện các giai đoạn cũ đã đóng (user request
  // 2026-08-18: "chỉ hiển thị lương mới nhất thôi, và để 1 tháng thay vì từ tháng này đến tháng
  // kia") — đảo lại quyết định trước đó "mỗi giai đoạn 1 dòng" (xem context/spec.md Changelog).
  const costDetailRows: CostDetailRow[] = [
    ...adExpenses.items.map((row) => ({
      key: `ads-${row.adExpenseId}`,
      pageId: null,
      pageName: null,
      type: "Ads" as const,
      sortDate: row.expenseMonth,
      monthLabel: formatMonth(row.expenseMonth.toISOString().slice(0, 7)),
      amount: row.amount,
      paidByAdminName: row.paidByAdminName,
      note: row.note,
    })),
    ...pagePurchaseExpenses.map((row) => ({
      key: `purchase-${row.pageId}`,
      pageId: row.pageId,
      pageName: row.pageName,
      type: "Mua Page" as const,
      sortDate: row.purchaseMonth,
      monthLabel: formatMonth(row.purchaseMonth.toISOString().slice(0, 7)),
      amount: row.amount,
      paidByAdminName: row.paidByAdminName,
      note: null,
    })),
    ...(currentSalaryRecord
      ? [
          {
            key: `salary-${currentSalaryRecord.id}`,
            pageId: null,
            pageName: null,
            type: "Lương" as const,
            sortDate: currentSalaryRecord.effectiveFrom,
            monthLabel: formatMonth(currentSalaryRecord.effectiveFrom.toISOString().slice(0, 7)),
            amount: currentSalaryRecord.monthlySalary,
            paidByAdminName: adminNameById.get(currentSalaryRecord.paidByAdminId) ?? "—",
            note: null,
          },
        ]
      : []),
    // "Bù chi phí" (user request 2026-08-19, renamed from "Chốt lợi nhuận" per user
    // clarification: "số tiền đó tách ra để bù chi phí, số tiền còn lại mới là lợi nhuận")
    // — no Page, no "Người chi" (system-computed at settlement time, not a payer choice
    // like the other 3 types).
    ...profitSettlements.map((row) => ({
      key: `settlement-${row.id}`,
      pageId: null,
      pageName: null,
      type: "Bù chi phí" as const,
      sortDate: row.createdAt,
      monthLabel: formatMonth(row.createdAt.toISOString().slice(0, 7)),
      amount: row.amount,
      paidByAdminName: "—",
      note: row.note,
    })),
  ].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

  // Replaces the "Lương hiện tại" card up top (user request 2026-08-18 — it duplicated
  // "Lương (luỹ kế)" already shown in the Chi phí tab; still editable via "Đổi lương").
  const profit = financials.revenue - financials.totalCost;

  const chartData = monthlySeries.map((row) => ({
    month: shortMonthLabel(row.month),
    revenue: toMillions(row.revenue),
    expenses: toMillions(row.totalCost),
  }));

  return (
    <div>
      <PageHeader
        title={employee.name}
        description={employee.email}
        action={
          <div className="flex items-center gap-stack-sm">
            <StatusChip status={employee.status} />
            {profit > 0n ? (
              <SettleProfitButton
                employeeId={employee.employeeId}
                employeeName={employee.name}
                currentProfit={profit}
              />
            ) : null}
            <EditEmployeeDialog
              employeeId={employee.employeeId}
              defaultValues={{ name: employee.name, email: employee.email, status: employee.status }}
            />
            <SetSalaryDialog
              employeeId={employee.employeeId}
              currentSalary={employee.currentSalary}
              currentEffectiveFrom={currentSalaryRecord?.effectiveFrom ?? null}
              adminOptions={adminOptions}
            />
            {employee.status === "ACTIVE" ? (
              <DeactivateEmployeeButton employeeId={employee.employeeId} employeeName={employee.name} />
            ) : null}
          </div>
        }
      />

      <div className="mb-gutter grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryStat label="Lợi nhuận" value={formatVnd(profit)} tone={profitTextClass(profit)} />
        <SummaryStat label="Tổng doanh thu" value={formatVnd(financials.revenue)} tone={REVENUE_TEXT_CLASS} />
        <SummaryStat label="Tổng chi phí" value={formatVnd(financials.totalCost)} tone={EXPENSE_TEXT_CLASS} />
        <SummaryStat label="Page đang quản lý" value={String(employee.activePages)} />
      </div>

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Doanh thu</TabsTrigger>
          <TabsTrigger value="costs">Chi phí</TabsTrigger>
          <TabsTrigger value="pages">Page</TabsTrigger>
          <TabsTrigger value="via">Via</TabsTrigger>
          <TabsTrigger value="chart">Biểu đồ theo tháng</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="pt-stack-md">
          {revenue.items.length === 0 ? (
            <EmptyState icon={Receipt} title="Chưa có doanh thu" description="Doanh thu được snapshot cho nhân viên này sẽ hiển thị tại đây." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-ice hover:bg-surface-ice">
                    <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Page</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tháng</TableHead>
                    <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Số tiền</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenue.items.map((row, index) => (
                    <TableRow key={row.revenueId} className="border-border-subtle">
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                      <TableCell>
                        <Link href={`/admin/pages/${row.pageId}`} className="font-medium text-on-surface hover:text-finance-blue">
                          {row.pageName}
                        </Link>
                      </TableCell>
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{formatMonth(row.revenueMonth.toISOString().slice(0, 7))}</TableCell>
                      <TableCell className={`text-right font-data-tabular text-data-tabular ${REVENUE_TEXT_CLASS}`}>{formatVnd(row.amount)}</TableCell>
                      <TableCell className="text-on-surface-variant">{row.note ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {revenue.total > revenue.items.length ? (
            <p className="mt-stack-sm">
              <Link href={`/admin/revenue?employee=${employeeId}`} className="font-body-md text-body-md text-finance-blue hover:underline">
                Xem toàn bộ {revenue.total} dòng doanh thu →
              </Link>
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="costs" className="pt-stack-md">
          <div className="mb-gutter grid grid-cols-1 gap-4 sm:grid-cols-4">
            <SummaryStat label="Ads" value={formatVnd(financials.adsCost)} tone={EXPENSE_TEXT_CLASS} />
            <SummaryStat label="Chi phí mua Page" value={formatVnd(financials.pagePurchaseCost)} tone={EXPENSE_TEXT_CLASS} />
            <SummaryStat label="Lương (luỹ kế)" value={formatVnd(financials.salaryCost)} tone={EXPENSE_TEXT_CLASS} />
            <SummaryStat label="Bù chi phí" value={formatVnd(financials.profitSettlementCost)} tone={EXPENSE_TEXT_CLASS} />
          </div>

          <h2 className="mb-stack-sm font-headline-sm text-headline-sm text-on-surface">Chi tiết chi phí</h2>
          {costDetailRows.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="Chưa có chi phí Ads/mua Page/Lương/Bù chi phí"
              description="Chi phí Ads, mua Page, Lương và Bù chi phí của nhân viên này sẽ hiển thị tại đây."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-ice hover:bg-surface-ice">
                    <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Page</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Loại</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tháng</TableHead>
                    <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Số tiền</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Người chi</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costDetailRows.map((row, index) => (
                    <TableRow key={row.key} className="border-border-subtle">
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                      <TableCell>
                        {row.pageId ? (
                          <Link href={`/admin/pages/${row.pageId}`} className="font-medium text-on-surface hover:text-finance-blue">
                            {row.pageName}
                          </Link>
                        ) : (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-on-surface-variant">{row.type}</TableCell>
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{row.monthLabel}</TableCell>
                      <TableCell className={`text-right font-data-tabular text-data-tabular ${EXPENSE_TEXT_CLASS}`}>{formatVnd(row.amount)}</TableCell>
                      <TableCell className="text-on-surface-variant">{row.paidByAdminName}</TableCell>
                      <TableCell className="text-on-surface-variant">{row.note ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {adExpenses.total > adExpenses.items.length ? (
            <p className="mt-stack-sm">
              <Link href={`/admin/ads?employee=${employeeId}`} className="font-body-md text-body-md text-finance-blue hover:underline">
                Xem toàn bộ {adExpenses.total} dòng Ads →
              </Link>
            </p>
          ) : null}
        </TabsContent>

        {/* Cùng bảng/style với "Page của tôi" bên User (user request 2026-08-19
            "hiển thị table giống page bên nhân viên") — Page ĐANG phụ trách
            (listPagesByEmployee, không phải lịch sử gán cũ), Tên Page dẫn
            sang Page Detail của Admin để sửa/chuyển giao đầy đủ, không có cột
            Thao tác riêng (khác EditPageStatusDialog bên User — action đó tự
            scope theo session của chính nhân viên, Admin không dùng lại
            được để sửa thay). */}
        <TabsContent value="pages" className="pt-stack-md">
          {pages.length === 0 ? (
            <EmptyState icon={FileText} title="Chưa phụ trách Page nào" description="Page nhân viên này đang phụ trách sẽ hiển thị tại đây." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-ice hover:bg-surface-ice">
                    <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tên Page</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Loại</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Link</TableHead>
                    <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Giá mua</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tháng mua</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Trạng thái</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Payout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((row, index) => (
                    <TableRow key={row.pageId} className="border-border-subtle">
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Read-only — nhân viên tự tạo/xoá via của chính mình ở "/user/vias"
            (user request 2026-08-20 "ai tạo là người đó cầm"), Admin chỉ xem
            lại tại đây để tra cứu, không có nút Tạo/Xoá. */}
        <TabsContent value="via" className="pt-stack-md">
          {vias.length === 0 ? (
            <EmptyState icon={IdCard} title="Chưa có via" description="Via nhân viên này tự tạo sẽ hiển thị tại đây." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-ice hover:bg-surface-ice">
                    <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tên via</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Link</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Page</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ngày tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vias.map((via, index) => (
                    <TableRow key={via.viaId} className="border-border-subtle">
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                      <TableCell className="font-medium text-on-surface">{via.name}</TableCell>
                      <TableCell>
                        <a
                          href={via.facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-on-surface-variant hover:text-finance-blue"
                        >
                          <ExternalLink className="size-3.5" strokeWidth={2} />
                          Mở link
                        </a>
                      </TableCell>
                      <TableCell className="text-on-surface-variant">
                        {via.pages.length === 0 ? "—" : via.pages.map((page) => page.name).join(", ")}
                      </TableCell>
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{formatDate(via.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="chart" className="pt-stack-md">
          <div className="rounded-lg border border-border-subtle bg-surface-container-lowest p-card-padding">
            <h2 className="mb-stack-md font-headline-sm text-headline-sm text-on-surface">Doanh thu &amp; Chi phí theo tháng</h2>
            <MonthlyRevenueChart data={chartData} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Chart Y-axis is scaled in "triệu đồng" (millions VND) — matches MonthlyRevenueChart's `${value}M` tick format. */
function toMillions(amount: bigint): number {
  return Number(amount) / 1_000_000;
}

/** "2026-08" -> "08/26" — compact enough for a 6-month x-axis, unambiguous across year boundaries. */
function shortMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${month}/${year.slice(2)}`;
}

