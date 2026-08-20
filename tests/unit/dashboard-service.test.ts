import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee } from "@/server/services/employee.service";
import { createPage } from "@/server/services/page.service";
import { transferPage } from "@/server/services/assignment.service";
import { createRevenue } from "@/server/services/revenue.service";
import { createAdExpense } from "@/server/services/ads.service";
import { createAdminExpense } from "@/server/services/admin-expense.service";
import { createAdminReceipt } from "@/server/services/receipt.service";
import { setEmployeeSalary } from "@/server/services/salary.service";
import {
  getSystemFinancials,
  getSystemMonthlySeries,
  getRecentActivity,
  getAdminSpendingBreakdown,
} from "@/server/services/dashboard.service";
import { formatVnd } from "@/lib/money";
import { currentMonthKey } from "@/lib/dates";
import { parseMonthKey, shiftMonthKey } from "@/lib/month";

let adminId: string;
let employeeId: string;
let employee2Id: string;
let employee2Name: string;
let pageId: string;
let pageName: string;
const createdUserIds: string[] = [];
const createdPageIds: string[] = [];

// A month far enough in the past to be unlikely to collide with data created
// by other test files / manual QA sessions, though the assertions below are
// delta-based (before vs. after fixture creation) so correctness never
// actually depends on the dev DB being otherwise empty for this month.
const TEST_MONTH = shiftMonthKey(currentMonthKey(), -20);
const TEST_MONTH_START = parseMonthKey(TEST_MONTH)!;
const NEXT_MONTH_START = parseMonthKey(shiftMonthKey(TEST_MONTH, 1))!;

const REVENUE_AMOUNT = 40_000_000n;
const ADS_AMOUNT = 6_000_000n;
const PURCHASE_AMOUNT = 5_000_000n;
const SALARY_AMOUNT = 8_000_000n;
const ADMIN_EXPENSE_AMOUNT = 12_000_000n;
const ADMIN_RECEIPT_AMOUNT = 70_000_000n;

let before: Awaited<ReturnType<typeof getSystemFinancials>>;
let after: Awaited<ReturnType<typeof getSystemFinancials>>;
let priorMonthBefore: Awaited<ReturnType<typeof getSystemFinancials>>;
let priorMonthAfter: Awaited<ReturnType<typeof getSystemFinancials>>;
let allTimeBefore: Awaited<ReturnType<typeof getSystemFinancials>>;
let allTimeAfter: Awaited<ReturnType<typeof getSystemFinancials>>;

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (dashboard-service)",
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;
  createdUserIds.push(admin.id);

  // Baselines captured before any fixture below exists.
  before = await getSystemFinancials(TEST_MONTH);
  priorMonthBefore = await getSystemFinancials(shiftMonthKey(TEST_MONTH, -1));
  allTimeBefore = await getSystemFinancials();

  const employee = await createEmployee(
    { name: "Dashboard Employee 1", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeId = employee.employeeId;
  createdUserIds.push(employee.userId);

  const employee2 = await createEmployee(
    { name: "Dashboard Employee 2", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employee2Id = employee2.employeeId;
  employee2Name = "Dashboard Employee 2";
  createdUserIds.push(employee2.userId);

  await setEmployeeSalary(employeeId, { paidByAdminId: adminId, monthlySalary: SALARY_AMOUNT, effectiveFrom: TEST_MONTH_START }, adminId);

  pageName = `Dashboard Test Page ${randomUUID()}`;
  const page = await createPage(
    {
      name: pageName,
      facebookUrl: "https://facebook.com/dashboard-test-page",
      purchasePrice: PURCHASE_AMOUNT,
      purchaseMonth: TEST_MONTH_START,
      assignEmployeeId: employeeId,
      paidByAdminId: adminId,
    },
    adminId,
  );
  pageId = page.pageId;
  createdPageIds.push(pageId);

  await createRevenue({ pageId, revenueMonth: TEST_MONTH_START, amount: REVENUE_AMOUNT }, adminId);
  await createAdExpense({ paidByAdminId: adminId, pageId, expenseMonth: TEST_MONTH_START, amount: ADS_AMOUNT }, adminId);

  await createAdminExpense(
    { paidByAdminId: adminId,
      expenseDate: TEST_MONTH_START,
      amount: ADMIN_EXPENSE_AMOUNT,
      description: "Dashboard test admin expense",
    },
    adminId,
  );

  await createAdminReceipt(
    { receiptMonth: TEST_MONTH_START, amount: ADMIN_RECEIPT_AMOUNT, source: "Dashboard test receipt", receivedByAdminId: adminId },
    adminId,
  );

  // Transfer the Page to employee 2 the following month, for the Recent Activity feed.
  await transferPage(pageId, { newEmployeeId: employee2Id, effectiveDate: NEXT_MONTH_START }, adminId);

  after = await getSystemFinancials(TEST_MONTH);
  priorMonthAfter = await getSystemFinancials(shiftMonthKey(TEST_MONTH, -1));
  allTimeAfter = await getSystemFinancials();
});

afterAll(async () => {
  const revenues = await prisma.revenue.findMany({ where: { pageId: { in: createdPageIds } }, select: { id: true } });
  const ads = await prisma.adExpense.findMany({ where: { pageId: { in: createdPageIds } }, select: { id: true } });
  const adminExpenses = await prisma.adminExpense.findMany({
    where: { createdByAdminId: adminId, description: "Dashboard test admin expense" },
    select: { id: true },
  });
  const adminReceipts = await prisma.adminReceipt.findMany({
    where: { createdByAdminId: adminId, source: "Dashboard test receipt" },
    select: { id: true },
  });

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { entityType: "Page", entityId: { in: createdPageIds } },
        { entityType: "Revenue", entityId: { in: revenues.map((r) => r.id) } },
        { entityType: "AdExpense", entityId: { in: ads.map((a) => a.id) } },
        { entityType: "AdminExpense", entityId: { in: adminExpenses.map((e) => e.id) } },
        { entityType: "AdminReceipt", entityId: { in: adminReceipts.map((r) => r.id) } },
      ],
    },
  });

  await prisma.revenue.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.adExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pagePurchaseExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pageAssignment.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.page.deleteMany({ where: { id: { in: createdPageIds } } });
  await prisma.adminExpense.deleteMany({ where: { createdByAdminId: adminId, description: "Dashboard test admin expense" } });
  await prisma.adminReceipt.deleteMany({ where: { createdByAdminId: adminId, source: "Dashboard test receipt" } });
  await prisma.salaryHistory.deleteMany({ where: { employee: { userId: { in: createdUserIds } } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("getSystemFinancials", () => {
  it("Total Expenses = PagePurchase + Ads + Salary + AdminExpenses (spec §10.3)", () => {
    expect(after.pagePurchaseCost - before.pagePurchaseCost).toBe(PURCHASE_AMOUNT);
    expect(after.adsCost - before.adsCost).toBe(ADS_AMOUNT);
    expect(after.salaryCost - before.salaryCost).toBe(SALARY_AMOUNT);
    expect(after.adminExpenseCost - before.adminExpenseCost).toBe(ADMIN_EXPENSE_AMOUNT);
    expect(after.totalExpenses - before.totalExpenses).toBe(
      PURCHASE_AMOUNT + ADS_AMOUNT + SALARY_AMOUNT + ADMIN_EXPENSE_AMOUNT,
    );
  });

  it("Total Received = Σ AdminReceipts, independent of Page Revenue (spec §9, §10.4, §60)", () => {
    expect(after.totalReceived - before.totalReceived).toBe(ADMIN_RECEIPT_AMOUNT);
    expect(after.totalPageRevenue - before.totalPageRevenue).toBe(REVENUE_AMOUNT);
    expect(after.totalReceived - before.totalReceived).not.toBe(after.totalPageRevenue - before.totalPageRevenue);
  });

  it("Profit = Total Received - Total Expenses (spec §10.5)", () => {
    const expectedExpensesDelta = PURCHASE_AMOUNT + ADS_AMOUNT + SALARY_AMOUNT + ADMIN_EXPENSE_AMOUNT;
    const expectedProfitDelta = ADMIN_RECEIPT_AMOUNT - expectedExpensesDelta;
    expect(after.profit - before.profit).toBe(expectedProfitDelta);
    expect(after.profit).toBe(after.totalReceived - after.totalExpenses);
  });

  it("the month before TEST_MONTH sees none of these fixtures (Page purchased/Revenue/Ads/Salary all start exactly on TEST_MONTH day 1)", () => {
    expect(priorMonthAfter.salaryCost - priorMonthBefore.salaryCost).toBe(0n);
    expect(priorMonthAfter.pagePurchaseCost - priorMonthBefore.pagePurchaseCost).toBe(0n);
    expect(priorMonthAfter.totalPageRevenue - priorMonthBefore.totalPageRevenue).toBe(0n);
    expect(priorMonthAfter.adsCost - priorMonthBefore.adsCost).toBe(0n);
  });
});

describe("getSystemFinancials — mid-month salary changes (user request 2026-08-18)", () => {
  it("a SalaryHistory row with effectiveFrom mid-month is counted in that same month's system-wide salaryCost", async () => {
    const midMonthEmployee = await createEmployee(
      { name: "Dashboard Mid-Month Salary Employee", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
      adminId,
    );
    createdUserIds.push(midMonthEmployee.userId);

    const midMonthDelta = 9_000_000n;
    const midMonthBefore = await getSystemFinancials(TEST_MONTH);

    const midMonthDate = new Date(TEST_MONTH_START);
    midMonthDate.setUTCDate(15);
    await setEmployeeSalary(
      midMonthEmployee.employeeId,
      { paidByAdminId: adminId, monthlySalary: midMonthDelta, effectiveFrom: midMonthDate },
      adminId,
    );

    const midMonthAfter = await getSystemFinancials(TEST_MONTH);
    expect(midMonthAfter.salaryCost - midMonthBefore.salaryCost).toBe(midMonthDelta);
  });

  it("two salary changes for the same employee within the same month: only the later rate counts, they don't sum (user-reported bug 2026-08-18)", async () => {
    const employee = await createEmployee(
      { name: "Dashboard Two Raises Same Month Employee", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
      adminId,
    );
    createdUserIds.push(employee.userId);

    const before = await getSystemFinancials(TEST_MONTH);

    const day5 = new Date(TEST_MONTH_START);
    day5.setUTCDate(5);
    const day10 = new Date(TEST_MONTH_START);
    day10.setUTCDate(10);
    await setEmployeeSalary(employee.employeeId, { paidByAdminId: adminId, monthlySalary: 6_000_000n, effectiveFrom: day5 }, adminId);
    await setEmployeeSalary(employee.employeeId, { paidByAdminId: adminId, monthlySalary: 7_000_000n, effectiveFrom: day10 }, adminId);

    const after = await getSystemFinancials(TEST_MONTH);
    expect(after.salaryCost - before.salaryCost).toBe(7_000_000n); // the later rate, NOT 6M + 7M
  });
});

describe("getSystemFinancials — all-time (monthKey omitted, user request 2026-08-18 \"muốn báo cáo all\")", () => {
  it("Total Received/Page Revenue/Ads/PagePurchase/AdminExpenses deltas match the fixtures exactly (single-shot amounts, no accrual)", () => {
    expect(allTimeAfter.totalReceived - allTimeBefore.totalReceived).toBe(ADMIN_RECEIPT_AMOUNT);
    expect(allTimeAfter.totalPageRevenue - allTimeBefore.totalPageRevenue).toBe(REVENUE_AMOUNT);
    expect(allTimeAfter.adsCost - allTimeBefore.adsCost).toBe(ADS_AMOUNT);
    expect(allTimeAfter.pagePurchaseCost - allTimeBefore.pagePurchaseCost).toBe(PURCHASE_AMOUNT);
    expect(allTimeAfter.adminExpenseCost - allTimeBefore.adminExpenseCost).toBe(ADMIN_EXPENSE_AMOUNT);
  });

  it("Salary is life-to-date accrued (same formula as getEmployeeFinancials' all-time mode), not just the latest rate — at least 1 month's worth for a still-active SalaryHistory row", () => {
    expect(allTimeAfter.salaryCost - allTimeBefore.salaryCost).toBeGreaterThanOrEqual(SALARY_AMOUNT);
  });

  it("Total Expenses / Profit stay internally consistent with the other fields (spec §10.3/§10.5) even in all-time mode", () => {
    const expensesDelta = allTimeAfter.totalExpenses - allTimeBefore.totalExpenses;
    expect(expensesDelta).toBe(
      (allTimeAfter.pagePurchaseCost - allTimeBefore.pagePurchaseCost) +
        (allTimeAfter.adsCost - allTimeBefore.adsCost) +
        (allTimeAfter.salaryCost - allTimeBefore.salaryCost) +
        (allTimeAfter.adminExpenseCost - allTimeBefore.adminExpenseCost),
    );
    expect(allTimeAfter.profit - allTimeBefore.profit).toBe(
      (allTimeAfter.totalReceived - allTimeBefore.totalReceived) - expensesDelta,
    );
  });
});

describe("getSystemMonthlySeries", () => {
  it("returns 6 trailing months (current month last), consistent with a direct getSystemFinancials call", async () => {
    const series = await getSystemMonthlySeries(6);
    expect(series).toHaveLength(6);
    expect(series[5].month).toBe(currentMonthKey());

    const currentFinancials = await getSystemFinancials(currentMonthKey());
    expect(series[5].pageRevenue).toBe(currentFinancials.totalPageRevenue);
    expect(series[5].adminReceived).toBe(currentFinancials.totalReceived);
    expect(series[5].totalExpenses).toBe(currentFinancials.totalExpenses);
    expect(series[5].profit).toBe(currentFinancials.profit);
  });
});

describe("getAdminSpendingBreakdown", () => {
  it("sums Ads/PagePurchase/AdminExpense/Salary amounts scoped to the month, grouped by paid_by_admin_id — distinct from created_by_admin_id (user request, bổ sung sau Phase 13; Salary included per user request 2026-08-18)", async () => {
    const rows = await getAdminSpendingBreakdown(TEST_MONTH);
    const row = rows.find((r) => r.adminId === adminId);
    expect(row).toBeDefined();
    expect(row?.adsCost).toBe(ADS_AMOUNT);
    expect(row?.pagePurchaseCost).toBe(PURCHASE_AMOUNT);
    expect(row?.adminExpenseCost).toBe(ADMIN_EXPENSE_AMOUNT);
    // Other describe blocks above (mid-month salary changes) also add salaries
    // paid by this same adminId within TEST_MONTH, so assert a floor + internal
    // consistency instead of an exact cross-block-fragile total.
    expect(row?.salaryCost ?? 0n).toBeGreaterThanOrEqual(SALARY_AMOUNT);
    expect(row?.total).toBe(
      (row?.adsCost ?? 0n) + (row?.pagePurchaseCost ?? 0n) + (row?.adminExpenseCost ?? 0n) + (row?.salaryCost ?? 0n),
    );
  });

  it("Salary paid by this admin (paid_by_admin_id) is included in salaryCost/total (user request 2026-08-18: \"admin đã chi lương mà không cộng vào tổng chi\")", async () => {
    const salaryEmployee = await createEmployee(
      { name: "Dashboard Spending Salary Employee", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
      adminId,
    );
    createdUserIds.push(salaryEmployee.userId);

    const before = await getAdminSpendingBreakdown(TEST_MONTH);
    const beforeRow = before.find((r) => r.adminId === adminId);

    const salaryDelta = 3_000_000n;
    await setEmployeeSalary(
      salaryEmployee.employeeId,
      { paidByAdminId: adminId, monthlySalary: salaryDelta, effectiveFrom: TEST_MONTH_START },
      adminId,
    );

    const after = await getAdminSpendingBreakdown(TEST_MONTH);
    const afterRow = after.find((r) => r.adminId === adminId);

    expect((afterRow?.salaryCost ?? 0n) - (beforeRow?.salaryCost ?? 0n)).toBe(salaryDelta);
    expect((afterRow?.total ?? 0n) - (beforeRow?.total ?? 0n)).toBe(salaryDelta);
  });

  it("sums AdminReceipt amounts scoped to the month, grouped by received_by_admin_id (user request 2026-08-18)", async () => {
    const rows = await getAdminSpendingBreakdown(TEST_MONTH);
    const row = rows.find((r) => r.adminId === adminId);
    expect(row?.receivedAmount).toBe(ADMIN_RECEIPT_AMOUNT);
    // Never netted into `total`, which stays "chi phí" only (now includes Salary too).
    expect(row?.total).toBe(
      (row?.adsCost ?? 0n) + (row?.pagePurchaseCost ?? 0n) + (row?.adminExpenseCost ?? 0n) + (row?.salaryCost ?? 0n),
    );
  });

  it("profit = receivedAmount - total, shown on the Dashboard breakdown table instead of the Ads/Mua Page/Tài nguyên split (user request 2026-08-18)", async () => {
    const rows = await getAdminSpendingBreakdown(TEST_MONTH);
    const row = rows.find((r) => r.adminId === adminId);
    expect(row?.profit).toBe((row?.receivedAmount ?? 0n) - (row?.total ?? 0n));
  });

  it("all-time (no monthKey) still includes this admin's fixture spending and received amount", async () => {
    const rows = await getAdminSpendingBreakdown();
    const row = rows.find((r) => r.adminId === adminId);
    expect(row?.total ?? 0n).toBeGreaterThanOrEqual(ADS_AMOUNT + PURCHASE_AMOUNT + ADMIN_EXPENSE_AMOUNT);
    expect(row?.receivedAmount ?? 0n).toBeGreaterThanOrEqual(ADMIN_RECEIPT_AMOUNT);
  });

  it("a month before TEST_MONTH sees none of this admin's fixture spending or received amount", async () => {
    const rows = await getAdminSpendingBreakdown(shiftMonthKey(TEST_MONTH, -1));
    const row = rows.find((r) => r.adminId === adminId);
    expect(row?.total ?? 0n).toBe(0n);
    expect(row?.receivedAmount ?? 0n).toBe(0n);
  });

  it("lists every ADMIN-role user, even ones with zero spending", async () => {
    const rows = await getAdminSpendingBreakdown(TEST_MONTH);
    expect(rows.some((r) => r.adminId === adminId)).toBe(true);
    // Real seed admins should also appear even though they didn't pay for this test's fixtures.
    const seedAdmin = await prisma.user.findFirst({ where: { role: "ADMIN", email: { not: { contains: "test-admin" } } } });
    if (seedAdmin) {
      expect(rows.some((r) => r.adminId === seedAdmin.id)).toBe(true);
    }
  });
});

describe("getRecentActivity", () => {
  it("surfaces Revenue/Ads/Page/Transfer/AdminExpense/AdminReceipt events, newest first (spec §11.4)", async () => {
    const { items } = await getRecentActivity({ pageSize: 20 });

    expect(items.some((i) => i.type === "REVENUE" && i.message.includes(pageName) && i.message.includes(formatVnd(REVENUE_AMOUNT)))).toBe(true);
    expect(items.some((i) => i.type === "ADS" && i.message.includes(pageName) && i.message.includes(formatVnd(ADS_AMOUNT)))).toBe(true);
    expect(items.some((i) => i.type === "PAGE_NEW" && i.message.includes(pageName))).toBe(true);
    expect(items.some((i) => i.type === "PAGE_TRANSFER" && i.message.includes(pageName) && i.message.includes(employee2Name))).toBe(true);
    expect(items.some((i) => i.type === "ADMIN_EXPENSE" && i.message.includes(formatVnd(ADMIN_EXPENSE_AMOUNT)))).toBe(true);
    expect(items.some((i) => i.type === "ADMIN_RECEIPT" && i.message.includes(formatVnd(ADMIN_RECEIPT_AMOUNT)))).toBe(true);

    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].occurredAt.getTime()).toBeGreaterThanOrEqual(items[i].occurredAt.getTime());
    }
  });

  it("respects the `pageSize` parameter and reports `total`", async () => {
    const { items, total, page, pageSize } = await getRecentActivity({ pageSize: 5 });
    expect(items.length).toBeLessThanOrEqual(5);
    expect(page).toBe(1);
    expect(pageSize).toBe(5);
    expect(total).toBeGreaterThanOrEqual(items.length);
  });

  it("page 2 returns the next window, not overlapping page 1", async () => {
    const pageOne = await getRecentActivity({ page: 1, pageSize: 5 });
    const pageTwo = await getRecentActivity({ page: 2, pageSize: 5 });
    const pageOneIds = new Set(pageOne.items.map((i) => i.id));
    expect(pageTwo.items.every((i) => !pageOneIds.has(i.id))).toBe(true);
  });
});
