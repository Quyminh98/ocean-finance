import { notFound } from "next/navigation";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd, EXPENSE_TEXT_CLASS } from "@/lib/money";
import { formatMonth } from "@/lib/dates";
import { requireUser } from "@/server/auth/rbac";
import { getEmployeeDetailByUserId, getEmployeeFinancials } from "@/server/services/employee.service";
import { getSalaryHistory } from "@/server/services/salary.service";
import { listAdExpenses } from "@/server/services/ads.service";
import { listPagePurchaseExpensesByEmployee } from "@/server/services/page.service";
import { listAdminOptions } from "@/server/services/user-account.service";
import { listProfitSettlements } from "@/server/services/profit-settlement.service";

type CostDetailRow = {
  key: string;
  /** null for Lương/Bù chi phí rows — not tied to any Page. */
  pageName: string | null;
  type: "Ads" | "Mua Page" | "Lương" | "Bù chi phí";
  sortDate: Date;
  monthLabel: string;
  amount: bigint;
  /** "—" for Bù chi phí rows — system-computed, no "Người chi" (user request 2026-08-19). */
  paidByAdminName: string;
  note: string | null;
};

export default async function UserCostsPage() {
  // RBAC: employeeId always resolved from session (never from a client param).
  const user = await requireUser();
  const profile = await getEmployeeDetailByUserId(user.id);
  if (!profile) notFound();

  const [financials, salaryHistory, adExpenses, pagePurchaseExpenses, adminOptions, profitSettlements] = await Promise.all([
    getEmployeeFinancials(profile.employeeId),
    getSalaryHistory(profile.employeeId),
    listAdExpenses({ employeeId: profile.employeeId, pageSize: 100 }),
    listPagePurchaseExpensesByEmployee(profile.employeeId),
    listAdminOptions(),
    listProfitSettlements(profile.employeeId),
  ]);
  const adminNameById = new Map(adminOptions.map((option) => [option.adminId, option.name]));
  const currentSalaryRecord = salaryHistory.find((row) => row.effectiveTo === null) ?? null;

  // Merged Ads + Page Purchase + Lương detail rows — same combined,
  // chronological "Chi tiết chi phí" table as admin's Employee Detail "Chi
  // phí" tab (user request 2026-08-18 "tôi cần bảng theo dõi như bên admin"),
  // scoped to the logged-in employee. Lương rows aren't tied to any Page.
  // Chỉ hiện mức lương ĐANG hiệu lực — không hiện các giai đoạn cũ đã đóng
  // (user request 2026-08-18: "chỉ hiển thị lương mới nhất thôi, và để 1
  // tháng thay vì từ tháng này đến tháng kia").
  const costDetailRows: CostDetailRow[] = [
    ...adExpenses.items.map((row) => ({
      key: `ads-${row.adExpenseId}`,
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
      pageName: null,
      type: "Bù chi phí" as const,
      sortDate: row.createdAt,
      monthLabel: formatMonth(row.createdAt.toISOString().slice(0, 7)),
      amount: row.amount,
      paidByAdminName: "—",
      note: row.note,
    })),
  ].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

  return (
    <div>
      <PageHeader title="Chi phí của tôi" description="Chi phí được tính cho bạn: Ads, chi phí mua Page, lương và bù chi phí." />

      <div className="mb-gutter grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="Ads" value={Number(financials.adsCost)} tone="expense" />
        <KpiCard label="Chi phí mua Page" value={Number(financials.pagePurchaseCost)} tone="expense" />
        <KpiCard label="Lương" value={Number(financials.salaryCost)} tone="expense" />
        <KpiCard label="Bù chi phí" value={Number(financials.profitSettlementCost)} tone="expense" />
        <KpiCard label="Tổng chi phí" value={Number(financials.totalCost)} highlight tone="expense" />
      </div>

      <h2 className="mb-stack-sm font-headline-sm text-headline-sm text-on-surface">Chi tiết chi phí</h2>
      {costDetailRows.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Chưa có chi phí Ads/mua Page/Lương/Bù chi phí"
          description="Chi phí Ads, mua Page, Lương và Bù chi phí của bạn sẽ hiển thị tại đây."
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
                  <TableCell className="font-medium text-on-surface">{row.pageName ?? <span className="text-on-surface-variant">—</span>}</TableCell>
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
    </div>
  );
}
