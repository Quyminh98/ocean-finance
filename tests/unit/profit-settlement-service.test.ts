import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee, getEmployeeFinancials } from "@/server/services/employee.service";
import { createPage } from "@/server/services/page.service";
import { createRevenue } from "@/server/services/revenue.service";
import { currentMonthKey } from "@/lib/dates";
import { parseMonthKey, monthDateRange } from "@/lib/month";
import { listProfitSettlements, settleEmployeeProfit, ProfitSettlementError } from "@/server/services/profit-settlement.service";

let adminId: string;
let profitableEmployeeId: string;
let brokeEmployeeId: string;
const createdUserIds: string[] = [];
const createdPageIds: string[] = [];

const CURRENT = currentMonthKey();

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (profit-settlement-service)",
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;
  createdUserIds.push(admin.id);

  const profitable = await createEmployee(
    { name: `Profitable Employee ${randomUUID()}`, email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  profitableEmployeeId = profitable.employeeId;
  createdUserIds.push(profitable.userId);

  const broke = await createEmployee(
    { name: `Broke Employee ${randomUUID()}`, email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  brokeEmployeeId = broke.employeeId;
  createdUserIds.push(broke.userId);

  // No purchase price / ads / salary — cost stays 0, so 30M revenue = 30M profit.
  const page = await createPage(
    {
      name: `Test Page ${randomUUID()}`,
      facebookUrl: "https://facebook.com/test-profit-settlement",
      purchasePrice: 0n,
      purchaseMonth: parseMonthKey(CURRENT)!,
      assignEmployeeId: profitableEmployeeId,
    },
    adminId,
  );
  createdPageIds.push(page.pageId);
  await createRevenue({ pageId: page.pageId, revenueMonth: monthDateRange(CURRENT)!.gte, amount: 30_000_000n }, adminId);
});

afterAll(async () => {
  await prisma.employeeProfitSettlement.deleteMany({ where: { employeeId: { in: [profitableEmployeeId, brokeEmployeeId] } } });
  await prisma.revenue.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pageAssignment.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.page.deleteMany({ where: { id: { in: createdPageIds } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("settleEmployeeProfit", () => {
  it("records the exact current profit as a settlement, writes an audit SETTLE entry, and — because the settlement is now itself a Cost component (user request 2026-08-19) — nets the running profit back to 0", async () => {
    const before = await getEmployeeFinancials(profitableEmployeeId);
    expect(before.revenue - before.totalCost).toBe(30_000_000n);

    const result = await settleEmployeeProfit(profitableEmployeeId, adminId);
    expect(result.amount).toBe(30_000_000n);

    const after = await getEmployeeFinancials(profitableEmployeeId);
    expect(after.profitSettlementCost).toBe(30_000_000n);
    expect(after.totalCost).toBe(before.totalCost + 30_000_000n);
    expect(after.revenue - after.totalCost).toBe(0n);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "EmployeeProfitSettlement", action: "SETTLE" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    expect((audit?.afterJson as { amount: string })?.amount).toBe("30000000");
  });

  it("rejects settling again immediately after — nothing positive left to settle", async () => {
    await expect(settleEmployeeProfit(profitableEmployeeId, adminId)).rejects.toThrow(ProfitSettlementError);
  });

  it("rejects settling an employee with zero/negative profit", async () => {
    await expect(settleEmployeeProfit(brokeEmployeeId, adminId)).rejects.toThrow(ProfitSettlementError);
  });

  it("a fresh round of revenue makes the employee eligible again, and settles independently of the past settlement", async () => {
    const page = await createPage(
      {
        name: `Test Page Round 2 ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-profit-settlement-round2",
        purchasePrice: 0n,
        purchaseMonth: parseMonthKey(CURRENT)!,
        assignEmployeeId: profitableEmployeeId,
      },
      adminId,
    );
    createdPageIds.push(page.pageId);
    await createRevenue({ pageId: page.pageId, revenueMonth: monthDateRange(CURRENT)!.gte, amount: 12_000_000n }, adminId);

    const before = await getEmployeeFinancials(profitableEmployeeId);
    expect(before.profitSettlementCost).toBe(30_000_000n); // the earlier settlement still counts as Cost
    expect(before.revenue - before.totalCost).toBe(12_000_000n); // new revenue minus the already-settled amount

    const result = await settleEmployeeProfit(profitableEmployeeId, adminId);
    expect(result.amount).toBe(12_000_000n);

    const after = await getEmployeeFinancials(profitableEmployeeId);
    expect(after.profitSettlementCost).toBe(42_000_000n);
    expect(after.revenue - after.totalCost).toBe(0n);
  });
});

describe("listProfitSettlements", () => {
  it("returns every active settlement for the employee, newest first", async () => {
    const rows = await listProfitSettlements(profitableEmployeeId);
    expect(rows).toHaveLength(2);
    expect(rows[0].amount).toBe(12_000_000n); // settled second, so listed first
    expect(rows[1].amount).toBe(30_000_000n);
  });

  it("returns an empty array for an employee with no settlements", async () => {
    const rows = await listProfitSettlements(brokeEmployeeId);
    expect(rows).toEqual([]);
  });
});
