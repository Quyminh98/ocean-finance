import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee, getEmployeeFinancials, getEmployeeMonthlySeries } from "@/server/services/employee.service";
import { setEmployeeSalary } from "@/server/services/salary.service";
import { createPage } from "@/server/services/page.service";
import { createRevenue } from "@/server/services/revenue.service";
import { createAdExpense } from "@/server/services/ads.service";
import { getEmployeeAssignmentHistory } from "@/server/services/assignment.service";
import { currentMonthKey } from "@/lib/dates";
import { parseMonthKey, monthDateRange, shiftMonthKey } from "@/lib/month";

let adminId: string;
let employeeId: string;
let pageId: string;
const createdUserIds: string[] = [];
const createdPageIds: string[] = [];

// Relative to whatever "today" is at test-run time (not hardcoded), so the
// salary-accrual assertions (which depend on real wall-clock "now" inside
// `getEmployeeFinancials`) stay correct regardless of the host clock.
const CURRENT = currentMonthKey();
const M2 = shiftMonthKey(CURRENT, -2); // 2 months ago — "past" period
const M5 = shiftMonthKey(CURRENT, -5); // 5 months ago — start of salary history

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (employee-financials)",
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;
  createdUserIds.push(admin.id);

  const employee = await createEmployee(
    { name: "Financials Employee", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeId = employee.employeeId;
  createdUserIds.push(employee.userId);

  // Page purchased 2 months ago, purchase expense snapshots to this employee.
  const page = await createPage(
    {
      name: `Test Page ${randomUUID()}`,
      facebookUrl: "https://facebook.com/test-employee-financials",
      purchasePrice: 5_000_000n,
      purchaseMonth: parseMonthKey(M2)!,
      assignEmployeeId: employeeId,
      paidByAdminId: adminId,
    },
    adminId,
  );
  pageId = page.pageId;
  createdPageIds.push(pageId);

  // Revenue: one row in the current month, one row 2 months ago (both dated
  // to the 1st of their month, for a deterministic boundary comparison).
  await createRevenue({ pageId, revenueMonth: monthDateRange(CURRENT)!.gte, amount: 20_000_000n, note: "current" }, adminId);
  await createRevenue({ pageId, revenueMonth: monthDateRange(M2)!.gte, amount: 10_000_000n, note: "past" }, adminId);

  // Ads: one row in the current month, one row 2 months ago.
  await createAdExpense({ paidByAdminId: adminId, employeeId, expenseMonth: parseMonthKey(CURRENT)!, amount: 2_000_000n, note: "current" }, adminId);
  await createAdExpense({ paidByAdminId: adminId, employeeId, expenseMonth: parseMonthKey(M2)!, amount: 1_000_000n, note: "past" }, adminId);

  // Salary: closed period [M5, M2) at 10M/month, ongoing period [M2, now] at 15M/month.
  await setEmployeeSalary(employeeId, { paidByAdminId: adminId, monthlySalary: 10_000_000n, effectiveFrom: parseMonthKey(M5)! }, adminId);
  await setEmployeeSalary(employeeId, { paidByAdminId: adminId, monthlySalary: 15_000_000n, effectiveFrom: parseMonthKey(M2)! }, adminId);
});

afterAll(async () => {
  await prisma.revenue.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.adExpense.deleteMany({ where: { employeeId } });
  await prisma.pagePurchaseExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pageAssignment.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.page.deleteMany({ where: { id: { in: createdPageIds } } });
  await prisma.salaryHistory.deleteMany({ where: { employee: { userId: { in: createdUserIds } } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("getEmployeeFinancials", () => {
  it("all-time (no monthKey): sums every Revenue/Ads/PagePurchase row and accrues Salary across every SalaryHistory period (spec §10.1-10.2)", async () => {
    const result = await getEmployeeFinancials(employeeId);

    expect(result.revenue).toBe(30_000_000n); // 20M (current) + 10M (M2)
    expect(result.adsCost).toBe(3_000_000n); // 2M (current) + 1M (M2)
    expect(result.pagePurchaseCost).toBe(5_000_000n);
    // Closed period [M5,M2) = 3 months × 10M = 30M. Ongoing period [M2, now] = 3 months × 15M = 45M.
    expect(result.salaryCost).toBe(75_000_000n);
    expect(result.profitSettlementCost).toBe(0n); // no EmployeeProfitSettlement rows created in this suite
    expect(result.totalCost).toBe(result.adsCost + result.pagePurchaseCost + result.salaryCost + result.profitSettlementCost);
  });

  it("scoped to the current month: only counts rows dated within that month, Salary = the rate active on day 1 (spec §37)", async () => {
    const result = await getEmployeeFinancials(employeeId, CURRENT);

    expect(result.revenue).toBe(20_000_000n);
    expect(result.adsCost).toBe(2_000_000n);
    expect(result.pagePurchaseCost).toBe(0n); // purchase happened in M2, not the current month
    expect(result.salaryCost).toBe(15_000_000n); // the ongoing (2nd) period's rate
  });

  it("scoped to a past month (M2): only counts that month's rows, Salary = the rate active that month", async () => {
    const result = await getEmployeeFinancials(employeeId, M2);

    expect(result.revenue).toBe(10_000_000n);
    expect(result.adsCost).toBe(1_000_000n);
    expect(result.pagePurchaseCost).toBe(5_000_000n); // the Page was purchased in M2
    expect(result.salaryCost).toBe(15_000_000n); // the 2nd period starts exactly on day 1 of M2
  });

  it("a month before any data existed (incl. before the first SalaryHistory) returns all-zero, not an error", async () => {
    const result = await getEmployeeFinancials(employeeId, shiftMonthKey(M5, -1));
    expect(result).toEqual({ revenue: 0n, adsCost: 0n, pagePurchaseCost: 0n, salaryCost: 0n, profitSettlementCost: 0n, totalCost: 0n });
  });
});

describe("getEmployeeFinancials — mid-month salary changes (user request 2026-08-18)", () => {
  it("a SalaryHistory row with effectiveFrom mid-month counts for that same month, not the next one", async () => {
    const employee = await createEmployee(
      { name: "Mid-Month Salary Employee", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
      adminId,
    );
    createdUserIds.push(employee.userId);

    const midMonth = new Date(monthDateRange(CURRENT)!.gte);
    midMonth.setUTCDate(15); // day 15, never day 1 — the case that used to defer to next month
    await setEmployeeSalary(employee.employeeId, { paidByAdminId: adminId, monthlySalary: 12_000_000n, effectiveFrom: midMonth }, adminId);

    const currentResult = await getEmployeeFinancials(employee.employeeId, CURRENT);
    expect(currentResult.salaryCost).toBe(12_000_000n);

    // Still active with no further change: the following month keeps counting it too (recurring rate, not a one-off).
    const nextResult = await getEmployeeFinancials(employee.employeeId, shiftMonthKey(CURRENT, 1));
    expect(nextResult.salaryCost).toBe(12_000_000n);

    // The month before it existed sees none of it.
    const priorResult = await getEmployeeFinancials(employee.employeeId, shiftMonthKey(CURRENT, -1));
    expect(priorResult.salaryCost).toBe(0n);
  });

  it("two salary changes within the same month: the later rate replaces the earlier one, they don't sum (user-reported bug 2026-08-18)", async () => {
    const employee = await createEmployee(
      { name: "Two Raises Same Month Employee", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
      adminId,
    );
    createdUserIds.push(employee.userId);

    const day5 = new Date(monthDateRange(CURRENT)!.gte);
    day5.setUTCDate(5);
    const day10 = new Date(monthDateRange(CURRENT)!.gte);
    day10.setUTCDate(10);

    await setEmployeeSalary(employee.employeeId, { paidByAdminId: adminId, monthlySalary: 8_000_000n, effectiveFrom: day5 }, adminId);
    await setEmployeeSalary(employee.employeeId, { paidByAdminId: adminId, monthlySalary: 10_000_000n, effectiveFrom: day10 }, adminId);

    const result = await getEmployeeFinancials(employee.employeeId, CURRENT);
    expect(result.salaryCost).toBe(10_000_000n); // the later rate, NOT 8M + 10M
  });
});

describe("getEmployeeMonthlySeries", () => {
  it("returns one datum per trailing month (current month last), matching per-month getEmployeeFinancials", async () => {
    const series = await getEmployeeMonthlySeries(employeeId, 6);
    expect(series).toHaveLength(6);
    expect(series[5].month).toBe(CURRENT);

    const currentFinancials = await getEmployeeFinancials(employeeId, CURRENT);
    expect(series[5].revenue).toBe(currentFinancials.revenue);
    expect(series[5].adsCost).toBe(currentFinancials.adsCost);
    expect(series[5].totalCost).toBe(currentFinancials.totalCost);
  });
});

describe("getEmployeeAssignmentHistory", () => {
  it("returns the Page this employee was assigned at creation, still active", async () => {
    const history = await getEmployeeAssignmentHistory(employeeId);
    expect(history).toHaveLength(1);
    expect(history[0].pageId).toBe(pageId);
    expect(history[0].endedAt).toBeNull();
  });
});
