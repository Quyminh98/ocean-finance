import { Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ExpenseBreakdownChart, type ExpenseBreakdownDatum } from "@/components/dashboard/expense-breakdown-chart";
import { SystemFinancialsChart } from "@/components/dashboard/system-financials-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { Pagination } from "@/components/tables/pagination";
import { MonthFilter } from "@/components/tables/month-filter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd, REVENUE_TEXT_CLASS, EXPENSE_TEXT_CLASS, profitTextClass } from "@/lib/money";
import { formatMonth } from "@/lib/dates";
import {
  getSystemFinancials,
  getSystemMonthlySeries,
  getAdminSpendingBreakdown,
  getRecentActivity,
  RECENT_ACTIVITY_PAGE_SIZE_OPTIONS,
  type RecentActivityPageSize,
} from "@/server/services/dashboard.service";

type DashboardSearchParams = { month?: string; page?: string; pageSize?: string };

/**
 * Month filter re-added 2026-08-19 (user request, reversing the same-day
 * earlier removal — see `context/plan.md`/`spec.md` Changelog) — reuses the
 * standard `MonthFilter` (blank = all-time, same as Employees/Revenue/Ads
 * lists) instead of the old bespoke `DashboardMonthPicker` that forced a
 * month to always be selected. `page`/`pageSize` below are for the "Lịch sử
 * thao tác" card only — Dashboard has no other consumer of those two params.
 */
export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const params = await searchParams;
  const activityPage = params.page ? Math.max(1, Number(params.page) || 1) : 1;
  const activityPageSizeCandidate = params.pageSize ? Number(params.pageSize) : 5;
  const activityPageSize: RecentActivityPageSize = (RECENT_ACTIVITY_PAGE_SIZE_OPTIONS as readonly number[]).includes(
    activityPageSizeCandidate,
  )
    ? (activityPageSizeCandidate as RecentActivityPageSize)
    : 5;

  const [financials, monthlySeries, adminSpending, recentActivity] = await Promise.all([
    getSystemFinancials(params.month),
    getSystemMonthlySeries(6),
    getAdminSpendingBreakdown(params.month),
    getRecentActivity({ page: activityPage, pageSize: activityPageSize }),
  ]);

  const kpis = [
    {
      label: "Tổng tiền Admin đã nhận",
      value: financials.totalReceived,
      hint: `Từ ${formatVnd(financials.totalPageRevenue)} Doanh thu Page`,
      tone: "revenue" as const,
    },
    { label: "Tổng lợi nhuận", value: financials.profit, tone: "profit" as const },
    { label: "Tổng doanh thu Page", value: financials.totalPageRevenue, tone: "revenue" as const },
  ];

  // Cơ cấu Tổng chi phí (user request 2026-08-18: "hiển thị biểu đồ tròn... tập
  // con của tổng chi phí") — Ads/Lương/Mua Page mirror the 3 cards này used to
  // be, now as donut slices that sum to `financials.totalExpenses` exactly.
  // "Tài nguyên" folds in as "Khác", only when > 0, so the slices always add
  // up to the full total shown in the center — same fix as the earlier
  // "1.000.000 ở đâu" KPI mismatch, applied here too. Color for "Khác" is
  // success-green **by explicit user request** (2026-08-18) — overrides the
  // component's own default rationale for avoiding it (green already means
  // "revenue" app-wide in lib/money.ts, and this slice is a cost); validated
  // CVD-safe as a 4-hue all-pairs set alongside blue/warning-orange/amber
  // before applying (`node scripts/validate_palette.js
  // "#0061ff,#c2410c,#ca8a04,#027a48" --pairs all` — passes).
  const expenseBreakdown: ExpenseBreakdownDatum[] = [
    { key: "ads", label: "Ads", value: financials.adsCost, color: "#0061FF" },
    { key: "salary", label: "Lương", value: financials.salaryCost, color: "#C2410C" },
    { key: "pagePurchase", label: "Page", value: financials.pagePurchaseCost, color: "#CA8A04" },
    { key: "other", label: "Tài nguyên", value: financials.adminExpenseCost, color: "#027A48" },
  ];

  const chartData = monthlySeries.map((datum) => ({
    month: datum.month,
    pageRevenue: Number(datum.pageRevenue),
    adminReceived: Number(datum.adminReceived),
    totalExpenses: Number(datum.totalExpenses),
    profit: Number(datum.profit),
  }));

  return (
    <div>
      <PageHeader
        title="Tổng quan tài chính"
        description={`Kỳ báo cáo ${params.month ? formatMonth(params.month) : "Tất cả thời gian"}`}
        action={<MonthFilter />}
      />

      <div className="mb-gutter grid grid-cols-1 gap-4 md:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} hint={kpi.hint} tone={kpi.tone} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-5">
        <div className="rounded-lg border border-border-subtle bg-surface-container-lowest p-card-padding lg:col-span-3">
          <h2 className="mb-stack-md font-headline-sm text-headline-sm text-on-surface">Biểu đồ Doanh thu &amp; Chi phí</h2>
          <SystemFinancialsChart data={chartData} />
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface-container-lowest p-card-padding lg:col-span-2">
          <h2 className="mb-stack-md font-headline-sm text-headline-sm text-on-surface">Cơ cấu chi phí</h2>
          <ExpenseBreakdownChart data={expenseBreakdown} total={financials.totalExpenses} />
        </div>
      </div>

      <div className="mt-gutter grid grid-cols-1 gap-gutter lg:grid-cols-3">
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border-subtle p-card-padding">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Chi phí &amp; Tiền đã nhận theo Admin</h2>
          </div>
          {adminSpending.every((row) => row.total === 0n && row.receivedAmount === 0n) ? (
            <EmptyState icon={Users} title="Chưa có chi phí hay khoản nhận nào" description="Số tiền từng Admin đã chi và đã nhận sẽ hiển thị tại đây." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-ice hover:bg-surface-ice">
                  <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Admin</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Tiền đã nhận</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Tổng đã chi</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Lợi nhuận</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminSpending.map((row, index) => (
                  <TableRow key={row.adminId} className="border-border-subtle">
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                    <TableCell className="font-medium text-on-surface">{row.name}</TableCell>
                    <TableCell className={`text-right font-data-tabular text-data-tabular ${REVENUE_TEXT_CLASS}`}>{formatVnd(row.receivedAmount)}</TableCell>
                    <TableCell className={`text-right font-data-tabular text-data-tabular ${EXPENSE_TEXT_CLASS}`}>{formatVnd(row.total)}</TableCell>
                    <TableCell className={`text-right font-data-tabular text-data-tabular ${profitTextClass(row.profit)}`}>{formatVnd(row.profit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
          <div className="border-b border-border-subtle p-card-padding">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Lịch sử thao tác</h2>
          </div>
          <div className="p-card-padding">
            <RecentActivity items={recentActivity.items} />
          </div>
          <Pagination
            page={recentActivity.page}
            pageSize={recentActivity.pageSize}
            total={recentActivity.total}
            pageSizeOptions={RECENT_ACTIVITY_PAGE_SIZE_OPTIONS}
          />
        </div>
      </div>
    </div>
  );
}
