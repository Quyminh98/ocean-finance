import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee } from "@/server/services/employee.service";
import { createPage } from "@/server/services/page.service";
import { transferPage } from "@/server/services/assignment.service";
import { createRevenue } from "@/server/services/revenue.service";

let adminId: string;
let employeeAId: string;
let employeeBId: string;
const createdUserIds: string[] = [];
const createdPageIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (revenue-transfer-flow)",
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;
  createdUserIds.push(admin.id);

  const employeeA = await createEmployee(
    { name: "Transfer Employee A", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeAId = employeeA.employeeId;
  createdUserIds.push(employeeA.userId);

  const employeeB = await createEmployee(
    { name: "Transfer Employee B", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeBId = employeeB.employeeId;
  createdUserIds.push(employeeB.userId);
});

afterAll(async () => {
  // AuditLog has no FK on entityId (free-form, spec §29) — deleting the
  // Page/Revenue/Employee fixtures below wouldn't clean these up on its own,
  // and they'd otherwise sit in the shared dev DB as orphaned TRANSFER/CREATE
  // rows forever, polluting Admin Dashboard "Lịch sử thao tác".
  const revenues = await prisma.revenue.findMany({ where: { pageId: { in: createdPageIds } }, select: { id: true } });
  await prisma.auditLog.deleteMany({
    where: { entityId: { in: [...createdPageIds, employeeAId, employeeBId, ...revenues.map((row) => row.id)] } },
  });
  await prisma.revenue.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pagePurchaseExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pageAssignment.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.page.deleteMany({ where: { id: { in: createdPageIds } } });
  await prisma.salaryHistory.deleteMany({ where: { employee: { userId: { in: createdUserIds } } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("Revenue snapshot across Page transfer (spec §52 Integration Test Case 1)", () => {
  it("keeps Revenue created before transfer with A, and Revenue created after transfer with B", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-revenue-transfer",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    // Revenue 10M while Page belongs to A.
    await createRevenue({ pageId: created.pageId, revenueMonth: new Date("2026-01-01"), amount: 10_000_000n }, adminId);

    // Transfer to B.
    await transferPage(created.pageId, { newEmployeeId: employeeBId, effectiveDate: new Date("2026-02-01") }, adminId);

    // Revenue 20M after transfer, while Page belongs to B.
    await createRevenue({ pageId: created.pageId, revenueMonth: new Date("2026-02-01"), amount: 20_000_000n }, adminId);

    const revenues = await prisma.revenue.findMany({ where: { pageId: created.pageId }, orderBy: { revenueMonth: "asc" } });
    expect(revenues).toHaveLength(2);

    const [revenueA, revenueB] = revenues;
    expect(revenueA.employeeIdSnapshot).toBe(employeeAId);
    expect(revenueA.amount).toBe(10_000_000n);
    expect(revenueB.employeeIdSnapshot).toBe(employeeBId);
    expect(revenueB.amount).toBe(20_000_000n);

    // Employee A's revenue total is unaffected by the transfer.
    const totalForA = await prisma.revenue.aggregate({
      where: { employeeIdSnapshot: employeeAId, pageId: created.pageId },
      _sum: { amount: true },
    });
    expect(totalForA._sum.amount).toBe(10_000_000n);

    const totalForB = await prisma.revenue.aggregate({
      where: { employeeIdSnapshot: employeeBId, pageId: created.pageId },
      _sum: { amount: true },
    });
    expect(totalForB._sum.amount).toBe(20_000_000n);
  });

  it("rejects creating Revenue dated before the Page had any assignment", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-revenue-before-assignment",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-03-01"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    await expect(
      createRevenue({ pageId: created.pageId, revenueMonth: new Date("2026-01-01"), amount: 1_000_000n }, adminId),
    ).rejects.toThrow();

    const count = await prisma.revenue.count({ where: { pageId: created.pageId } });
    expect(count).toBe(0);
  });
});
