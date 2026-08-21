import { prisma } from "@/lib/db";
import { parseMonthKey, monthDateRange, shiftMonthKey } from "@/lib/month";
import { currentMonthKey } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import { accruedSalaryCost, accruedRowCost, type SalaryHistoryRow } from "@/server/services/employee.service";

// ---------------------------------------------------------------------------
// System-wide financials (spec §10.3-10.5, §11.1). Scoped to a single
// "YYYY-MM" month by default; `monthKey` omitted = all-time (user request
// 2026-08-18 "muốn báo cáo all", mirrors the all-time mode already supported
// by `getEmployeeFinancials`/`getAdminSpendingBreakdown`). `Total Received`
// (AdminReceipt) and `Total Page Revenue` (Revenue) stay independent sums
// here, never joined/summed together (spec §9, §60, mirrors the note in
// receipt.service.ts).
// ---------------------------------------------------------------------------

export type SystemFinancials = {
  totalReceived: bigint;
  totalPageRevenue: bigint;
  adsCost: bigint;
  pagePurchaseCost: bigint;
  salaryCost: bigint;
  adminExpenseCost: bigint;
  totalExpenses: bigint;
  profit: bigint;
};

/**
 * Total Salary for a month = sum, per employee, of the LATEST SalaryHistory
 * rate that overlaps that month (user request 2026-08-18: a raise set
 * mid-month counts for that same month — "lương này trả 1 lần" — instead of
 * the earlier day-1-of-month convention, which deferred it to the following
 * month). A row overlaps `[range.gte, range.lt)` iff `effectiveFrom < range.lt`
 * and `effectiveTo` is null or after `range.gte`. If an employee's salary
 * changed more than once within the same month, only the most recent one
 * (max `effectiveFrom`) counts — it replaces the earlier rate, they don't sum
 * (user-reported bug 2026-08-18: this used to add both together).
 */
async function systemSalaryCostForMonth(range: { gte: Date; lt: Date }): Promise<bigint> {
  const overlappingRows = await prisma.salaryHistory.findMany({
    where: {
      effectiveFrom: { lt: range.lt },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: range.gte } }],
    },
    select: { employeeId: true, monthlySalary: true, effectiveFrom: true },
    orderBy: { effectiveFrom: "asc" },
  });
  const latestPerEmployee = new Map<string, bigint>();
  for (const row of overlappingRows) latestPerEmployee.set(row.employeeId, row.monthlySalary);
  return [...latestPerEmployee.values()].reduce((sum, amount) => sum + amount, 0n);
}

/**
 * All-time system-wide salary cost — sum, per employee, of
 * `accruedSalaryCost` (same life-to-date formula used by
 * `getEmployeeFinancials`'s all-time mode), then summed across every
 * employee. Distinct from `systemSalaryCostForMonth`, which picks one
 * point-in-time rate per employee — accrual needs every historical period.
 */
async function systemSalaryCostAllTime(): Promise<bigint> {
  const rows = await prisma.salaryHistory.findMany({
    select: { employeeId: true, monthlySalary: true, effectiveFrom: true, effectiveTo: true },
    orderBy: { effectiveFrom: "asc" },
  });
  const byEmployee = new Map<string, SalaryHistoryRow[]>();
  for (const row of rows) {
    const list = byEmployee.get(row.employeeId) ?? [];
    list.push(row);
    byEmployee.set(row.employeeId, list);
  }
  return [...byEmployee.values()].reduce((sum, histories) => sum + accruedSalaryCost(histories), 0n);
}

export async function getSystemFinancials(monthKey?: string): Promise<SystemFinancials> {
  const range = monthKey ? monthDateRange(monthKey) : null;
  const monthStart = monthKey ? parseMonthKey(monthKey) : null;
  if (monthKey && (!range || !monthStart)) throw new Error(`Invalid month key: ${monthKey}`);

  const [receiptAgg, revenueAgg, adsAgg, purchaseAgg, pendingPurchaseAgg, adminExpenseAgg, salaryCost] = await Promise.all([
    prisma.adminReceipt.aggregate({
      _sum: { amount: true },
      where: { deletedAt: null, ...(monthStart ? { receiptMonth: monthStart } : {}) },
    }),
    prisma.revenue.aggregate({
      _sum: { amount: true },
      where: { deletedAt: null, ...(monthStart ? { revenueMonth: monthStart } : {}) },
    }),
    prisma.adExpense.aggregate({
      _sum: { amount: true },
      where: { deletedAt: null, ...(monthStart ? { expenseMonth: monthStart } : {}) },
    }),
    prisma.pagePurchaseExpense.aggregate({
      _sum: { amount: true },
      where: { deletedAt: null, ...(monthStart ? { purchaseMonth: monthStart } : {}) },
    }),
    // Page has a purchase price + payer picked at creation time, but no
    // PagePurchaseExpense yet because it hasn't been assigned to an employee
    // (deferred by design — spec §5, `assignEmployee()` creates the real row
    // once an owner exists). The Admin already owes/paid this regardless of
    // assignment timing, so it must count now, not disappear until someone
    // gets assigned (user report 2026-08-20 "page chưa gán thì bị chưa tính
    // chi phí cho admin chi"). Once assigned, `purchaseExpense` stops being
    // null and this page naturally drops out of this aggregate — no
    // double-counting with `purchaseAgg` above.
    prisma.page.aggregate({
      _sum: { purchasePrice: true },
      where: {
        deletedAt: null,
        purchasePrice: { gt: 0 },
        purchaseExpense: null,
        ...(monthStart ? { purchaseMonth: monthStart } : {}),
      },
    }),
    prisma.adminExpense.aggregate({
      _sum: { amount: true },
      where: { deletedAt: null, ...(range ? { expenseDate: { gte: range.gte, lt: range.lt } } : {}) },
    }),
    range ? systemSalaryCostForMonth(range) : systemSalaryCostAllTime(),
  ]);

  const totalReceived = receiptAgg._sum.amount ?? 0n;
  const totalPageRevenue = revenueAgg._sum.amount ?? 0n;
  const adsCost = adsAgg._sum.amount ?? 0n;
  const pagePurchaseCost = (purchaseAgg._sum.amount ?? 0n) + (pendingPurchaseAgg._sum.purchasePrice ?? 0n);
  const adminExpenseCost = adminExpenseAgg._sum.amount ?? 0n;
  const totalExpenses = pagePurchaseCost + adsCost + salaryCost + adminExpenseCost;

  return {
    totalReceived,
    totalPageRevenue,
    adsCost,
    pagePurchaseCost,
    salaryCost,
    adminExpenseCost,
    totalExpenses,
    profit: totalReceived - totalExpenses,
  };
}

export type SystemMonthlyDatum = {
  month: string;
  pageRevenue: bigint;
  adminReceived: bigint;
  totalExpenses: bigint;
  profit: bigint;
};

/** Trailing `monthsBack` months (inclusive of the current month) for the Monthly Chart (spec §11.2) — independent of the KPI month filter. */
export async function getSystemMonthlySeries(monthsBack = 6): Promise<SystemMonthlyDatum[]> {
  const latest = currentMonthKey();
  const monthKeys = Array.from({ length: monthsBack }, (_, i) => shiftMonthKey(latest, i - (monthsBack - 1)));

  const results = await Promise.all(monthKeys.map((month) => getSystemFinancials(month)));
  return monthKeys.map((month, index) => ({
    month,
    pageRevenue: results[index].totalPageRevenue,
    adminReceived: results[index].totalReceived,
    totalExpenses: results[index].totalExpenses,
    profit: results[index].profit,
  }));
}

// ---------------------------------------------------------------------------
// Spending by Admin ("Người chi") — bổ sung sau Phase 13, xác nhận với user
// 2026-08-17. Sums AdExpense/PagePurchaseExpense/AdminExpense.amount grouped
// by `paid_by_admin_id` — distinct from `getSystemFinancials`'s totals, which
// don't care who personally paid. `monthKey` optional: omitted = all-time
// (Settings — User Accounts "Tổng đã chi"), set = scoped to that month
// (Admin Dashboard breakdown, same month filter as the KPI cards).
// `receivedAmount` (added 2026-08-18, user request) sums AdminReceipt.amount
// grouped by `received_by_admin_id` — same month filter, kept as a separate
// field (never netted into `total`, which stays "chi phí" only per the
// section's original meaning). `profit = receivedAmount - total` (added
// 2026-08-18, user request "thay vào đó là cột lợi nhuận") — per-Admin net,
// shown on the Dashboard breakdown table instead of the Ads/Mua Page/Tài
// nguyên split (Settings — User Accounts still reads `total` directly, so
// the breakdown fields themselves stay on the type, just unused by that UI).
// `salaryCost` (added 2026-08-18, user request "check lại xem admin đã chi
// lương mà không cộng vào tổng chi") — reverses the earlier "Không gồm
// Lương" scope decision from the Phase 13 bổ sung above: an Admin's `total`
// now includes Salary they paid (`paid_by_admin_id` on SalaryHistory), same
// as the other 3 expense types, so `total` genuinely means "everything this
// Admin personally paid for" instead of silently excluding one category.
// ---------------------------------------------------------------------------

export type AdminSpendingRow = {
  adminId: string;
  name: string;
  adsCost: bigint;
  pagePurchaseCost: bigint;
  adminExpenseCost: bigint;
  salaryCost: bigint;
  total: bigint;
  receivedAmount: bigint;
  profit: bigint;
};

/**
 * Salary cost by `paid_by_admin_id` for a single month — per employee, only
 * the LATEST overlapping SalaryHistory row counts (same dedup rule as
 * `systemSalaryCostForMonth` above), and that row's amount is attributed to
 * *that row's own* `paidByAdminId` (an employee's current payer may differ
 * from who originally set an earlier, now-superseded rate).
 */
async function salaryCostByAdminForMonth(range: { gte: Date; lt: Date }): Promise<Map<string, bigint>> {
  const overlappingRows = await prisma.salaryHistory.findMany({
    where: {
      effectiveFrom: { lt: range.lt },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: range.gte } }],
    },
    select: { employeeId: true, monthlySalary: true, effectiveFrom: true, paidByAdminId: true },
    orderBy: { effectiveFrom: "asc" },
  });
  const latestPerEmployee = new Map<string, { amount: bigint; paidByAdminId: string }>();
  for (const row of overlappingRows) {
    latestPerEmployee.set(row.employeeId, { amount: row.monthlySalary, paidByAdminId: row.paidByAdminId });
  }
  const byAdmin = new Map<string, bigint>();
  for (const { amount, paidByAdminId } of latestPerEmployee.values()) {
    byAdmin.set(paidByAdminId, (byAdmin.get(paidByAdminId) ?? 0n) + amount);
  }
  return byAdmin;
}

/**
 * All-time salary cost by `paid_by_admin_id` — each SalaryHistory period's
 * own accrued cost (`accruedRowCost`, same formula as `accruedSalaryCost`
 * but per-row instead of summed-per-employee) is attributed to that period's
 * own payer, then summed by admin. No employee-level dedup needed: unlike
 * the month-scoped view, accrual treats every historical period as its own
 * non-overlapping time window, so each row's contribution is independent.
 */
async function salaryCostByAdminAllTime(): Promise<Map<string, bigint>> {
  const rows = await prisma.salaryHistory.findMany({
    select: { monthlySalary: true, effectiveFrom: true, effectiveTo: true, paidByAdminId: true },
  });
  const byAdmin = new Map<string, bigint>();
  for (const row of rows) {
    byAdmin.set(row.paidByAdminId, (byAdmin.get(row.paidByAdminId) ?? 0n) + accruedRowCost(row));
  }
  return byAdmin;
}

export async function getAdminSpendingBreakdown(monthKey?: string): Promise<AdminSpendingRow[]> {
  const range = monthKey ? monthDateRange(monthKey) : null;
  const monthStart = monthKey ? parseMonthKey(monthKey) : null;
  if (monthKey && (!range || !monthStart)) throw new Error(`Invalid month key: ${monthKey}`);

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [adsGroups, purchaseGroups, pendingPurchaseGroups, adminExpenseGroups, receiptGroups, salaryByAdmin] = await Promise.all([
    prisma.adExpense.groupBy({
      by: ["paidByAdminId"],
      _sum: { amount: true },
      where: { deletedAt: null, ...(monthStart ? { expenseMonth: monthStart } : {}) },
    }),
    prisma.pagePurchaseExpense.groupBy({
      by: ["paidByAdminId"],
      _sum: { amount: true },
      where: { deletedAt: null, ...(monthStart ? { purchaseMonth: monthStart } : {}) },
    }),
    // Pages with a price + payer but not yet assigned — see the matching
    // comment in `getSystemFinancials` above (same fix, same reasoning,
    // 2026-08-20). `paidByAdminId: { not: null }` is defensive (the service
    // layer already requires it whenever purchasePrice > 0) but keeps the
    // `groupBy` key non-null so `.get(admin.id)` below matches correctly.
    prisma.page.groupBy({
      by: ["paidByAdminId"],
      _sum: { purchasePrice: true },
      where: {
        deletedAt: null,
        purchasePrice: { gt: 0 },
        purchaseExpense: null,
        paidByAdminId: { not: null },
        ...(monthStart ? { purchaseMonth: monthStart } : {}),
      },
    }),
    prisma.adminExpense.groupBy({
      by: ["paidByAdminId"],
      _sum: { amount: true },
      where: { deletedAt: null, ...(range ? { expenseDate: { gte: range.gte, lt: range.lt } } : {}) },
    }),
    prisma.adminReceipt.groupBy({
      by: ["receivedByAdminId"],
      _sum: { amount: true },
      where: { deletedAt: null, ...(monthStart ? { receiptMonth: monthStart } : {}) },
    }),
    range ? salaryCostByAdminForMonth(range) : salaryCostByAdminAllTime(),
  ]);

  const adsByAdmin = new Map(adsGroups.map((row) => [row.paidByAdminId, row._sum.amount ?? 0n]));
  const purchaseByAdmin = new Map(purchaseGroups.map((row) => [row.paidByAdminId, row._sum.amount ?? 0n]));
  for (const row of pendingPurchaseGroups) {
    const adminId = row.paidByAdminId!;
    purchaseByAdmin.set(adminId, (purchaseByAdmin.get(adminId) ?? 0n) + (row._sum.purchasePrice ?? 0n));
  }
  const adminExpenseByAdmin = new Map(adminExpenseGroups.map((row) => [row.paidByAdminId, row._sum.amount ?? 0n]));
  const receivedByAdmin = new Map(receiptGroups.map((row) => [row.receivedByAdminId, row._sum.amount ?? 0n]));

  return admins.map((admin) => {
    const adsCost = adsByAdmin.get(admin.id) ?? 0n;
    const pagePurchaseCost = purchaseByAdmin.get(admin.id) ?? 0n;
    const adminExpenseCost = adminExpenseByAdmin.get(admin.id) ?? 0n;
    const salaryCost = salaryByAdmin.get(admin.id) ?? 0n;
    const total = adsCost + pagePurchaseCost + adminExpenseCost + salaryCost;
    const receivedAmount = receivedByAdmin.get(admin.id) ?? 0n;
    return {
      adminId: admin.id,
      name: admin.name,
      adsCost,
      pagePurchaseCost,
      adminExpenseCost,
      salaryCost,
      total,
      receivedAmount,
      profit: receivedAmount - total,
    };
  });
}

// ---------------------------------------------------------------------------
// Recent Activity (spec §11.4) — union of the source tables (not AuditLog,
// except for Page transfers where AuditLog's `TRANSFER` action is the only
// clean signal separating a transfer from a Page's first assignment).
// ---------------------------------------------------------------------------

export type ActivityType = "REVENUE" | "ADS" | "PAGE_NEW" | "PAGE_TRANSFER" | "ADMIN_EXPENSE" | "ADMIN_RECEIPT";

export type ActivityFeedItem = {
  id: string;
  type: ActivityType;
  message: string;
  occurredAt: Date;
};

export const RECENT_ACTIVITY_PAGE_SIZE_OPTIONS = [5, 10, 20] as const;
export type RecentActivityPageSize = (typeof RECENT_ACTIVITY_PAGE_SIZE_OPTIONS)[number];

export type RecentActivityParams = {
  page?: number;
  pageSize?: RecentActivityPageSize;
};

export type RecentActivityResult = {
  items: ActivityFeedItem[];
  total: number;
  page: number;
  pageSize: RecentActivityPageSize;
};

/**
 * Paginated (user request 2026-08-19 — this used to be embedded in the Admin
 * Dashboard as a fixed-`limit` preview at Phase 11, then briefly had its own
 * full `/admin/activity` page/nav item, now folded back into the Dashboard
 * with real pagination instead of either). This is a union of 6 heterogeneous
 * sources (5 tables + AuditLog for transfers, see comment above) with no
 * shared sort key at the DB level, so true offset pagination isn't a single
 * query — each source is queried for its own top `page*pageSize` rows (the
 * global top `page*pageSize` most-recent items are always a subset of that,
 * a standard top-K-per-source merge bound), merged, re-sorted, then sliced to
 * the requested page window. `total` is a separate `count()` per source,
 * summed. Fine at this app's scale (CLAUDE.md "không tối ưu hoá sớm") — would
 * need a real cursor/union-view approach if this table set or its row counts
 * grow by orders of magnitude.
 */
export async function getRecentActivity(params: RecentActivityParams = {}): Promise<RecentActivityResult> {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const pageSize = params.pageSize && RECENT_ACTIVITY_PAGE_SIZE_OPTIONS.includes(params.pageSize) ? params.pageSize : 5;
  const fetchCount = page * pageSize;

  const [revenues, ads, newPages, transfers, adminExpenses, adminReceipts, counts] = await Promise.all([
    prisma.revenue.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: fetchCount,
      include: { page: { select: { name: true } } },
    }),
    prisma.adExpense.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: fetchCount,
      include: { employee: { include: { user: { select: { name: true } } } } },
    }),
    prisma.page.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: fetchCount,
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "Page", action: "TRANSFER" },
      orderBy: { createdAt: "desc" },
      take: fetchCount,
    }),
    prisma.adminExpense.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: fetchCount,
    }),
    prisma.adminReceipt.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: fetchCount,
    }),
    Promise.all([
      prisma.revenue.count({ where: { deletedAt: null } }),
      prisma.adExpense.count({ where: { deletedAt: null } }),
      prisma.page.count({ where: { deletedAt: null } }),
      prisma.auditLog.count({ where: { entityType: "Page", action: "TRANSFER" } }),
      prisma.adminExpense.count({ where: { deletedAt: null } }),
      prisma.adminReceipt.count({ where: { deletedAt: null } }),
    ]),
  ]);

  const transferPageIds = transfers.map((row) => row.entityId);
  const transferEmployeeIds = transfers
    .map((row) => (row.afterJson as { employeeId?: string } | null)?.employeeId)
    .filter((id): id is string => Boolean(id));

  const [transferPages, transferEmployees] = await Promise.all([
    prisma.page.findMany({ where: { id: { in: transferPageIds } }, select: { id: true, name: true } }),
    prisma.employeeProfile.findMany({
      where: { id: { in: transferEmployeeIds } },
      include: { user: { select: { name: true } } },
    }),
  ]);
  const pageNameById = new Map(transferPages.map((page) => [page.id, page.name]));
  const employeeNameById = new Map(transferEmployees.map((employee) => [employee.id, employee.user.name]));

  const items: ActivityFeedItem[] = [
    ...revenues.map((row) => ({
      id: `revenue-${row.id}`,
      type: "REVENUE" as const,
      message: `Doanh thu mới ${formatVnd(row.amount)} từ Page "${row.page.name}"`,
      occurredAt: row.createdAt,
    })),
    ...ads.map((row) => ({
      id: `ads-${row.id}`,
      type: "ADS" as const,
      message: `Chi phí Ads mới ${formatVnd(row.amount)} cho nhân viên "${row.employee.user.name}"`,
      occurredAt: row.createdAt,
    })),
    ...newPages.map((row) => ({
      id: `page-${row.id}`,
      type: "PAGE_NEW" as const,
      message: `Page mới "${row.name}" được thêm`,
      occurredAt: row.createdAt,
    })),
    ...transfers.map((row) => {
      const employeeId = (row.afterJson as { employeeId?: string } | null)?.employeeId;
      const pageName = pageNameById.get(row.entityId) ?? "Page";
      const employeeName = (employeeId ? employeeNameById.get(employeeId) : undefined) ?? "nhân viên khác";
      return {
        id: `transfer-${row.id}`,
        type: "PAGE_TRANSFER" as const,
        message: `Chuyển giao Page "${pageName}" sang ${employeeName}`,
        occurredAt: row.createdAt,
      };
    }),
    ...adminExpenses.map((row) => ({
      id: `admin-expense-${row.id}`,
      type: "ADMIN_EXPENSE" as const,
      message: `Tài nguyên mới ${formatVnd(row.amount)} — ${row.description}`,
      occurredAt: row.createdAt,
    })),
    ...adminReceipts.map((row) => ({
      id: `admin-receipt-${row.id}`,
      type: "ADMIN_RECEIPT" as const,
      message: `Khoản Admin đã nhận mới ${formatVnd(row.amount)} — ${row.source}`,
      occurredAt: row.createdAt,
    })),
  ];

  items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const total = counts.reduce((sum, count) => sum + count, 0);
  const start = (page - 1) * pageSize;

  return { items: items.slice(start, start + pageSize), total, page, pageSize };
}
