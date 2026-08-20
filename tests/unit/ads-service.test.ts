import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee } from "@/server/services/employee.service";
import { createPage } from "@/server/services/page.service";
import {
  createAdExpense,
  updateAdExpense,
  softDeleteAdExpense,
  listAdExpenses,
  parseMonthKey,
  AdExpenseError,
} from "@/server/services/ads.service";
import { PageError } from "@/server/services/page.service";

let adminId: string;
let employeeAId: string;
let employeeBId: string;
const createdUserIds: string[] = [];
const createdPageIds: string[] = [];

const JAN = parseMonthKey("2026-01")!;
const FEB = parseMonthKey("2026-02")!;
const MAR = parseMonthKey("2026-03")!;

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (ads-service)",
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;
  createdUserIds.push(admin.id);

  const employeeA = await createEmployee(
    { name: "Ads Employee A", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeAId = employeeA.employeeId;
  createdUserIds.push(employeeA.userId);

  const employeeB = await createEmployee(
    { name: "Ads Employee B", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeBId = employeeB.employeeId;
  createdUserIds.push(employeeB.userId);
});

afterAll(async () => {
  await prisma.adExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pagePurchaseExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pageAssignment.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.page.deleteMany({ where: { id: { in: createdPageIds } } });
  await prisma.salaryHistory.deleteMany({ where: { employee: { userId: { in: createdUserIds } } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("createAdExpense", () => {
  it("snapshots the employee assigned to the Page on the 1st of the month (spec §6)", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-ads-snapshot",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    const adExpense = await createAdExpense(
      { paidByAdminId: adminId, pageId: created.pageId, expenseMonth: JAN, amount: 1_000_000n, note: "Tháng 1" },
      adminId,
    );
    expect(adExpense.wasUpdate).toBe(false);

    const row = await prisma.adExpense.findUniqueOrThrow({ where: { id: adExpense.adExpenseId } });
    expect(row.employeeIdSnapshot).toBe(employeeAId);
    expect(row.amount).toBe(1_000_000n);
    expect(row.expenseMonth.toISOString().slice(0, 10)).toBe("2026-01-01");

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "AdExpense", entityId: adExpense.adExpenseId, action: "CREATE" },
    });
    expect(audit).not.toBeNull();
  });

  it("overwrites the existing month's amount instead of creating a 2nd row for the same Page+month", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-ads-upsert",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    const first = await createAdExpense({ paidByAdminId: adminId, pageId: created.pageId, expenseMonth: JAN, amount: 1_000_000n }, adminId);
    const second = await createAdExpense({ paidByAdminId: adminId, pageId: created.pageId, expenseMonth: JAN, amount: 2_500_000n, note: "updated" }, adminId);

    expect(second.wasUpdate).toBe(true);
    expect(second.adExpenseId).toBe(first.adExpenseId);

    const count = await prisma.adExpense.count({ where: { pageId: created.pageId, deletedAt: null } });
    expect(count).toBe(1);

    const row = await prisma.adExpense.findUniqueOrThrow({ where: { id: first.adExpenseId } });
    expect(row.amount).toBe(2_500_000n);
    expect(row.note).toBe("updated");

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "AdExpense", entityId: first.adExpenseId, action: "UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects creating AdExpense for a Page with no valid assignment at the start of that month (spec §17)", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-ads-no-owner",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    await expect(createAdExpense({ paidByAdminId: adminId, pageId: created.pageId, expenseMonth: JAN, amount: 500_000n }, adminId)).rejects.toThrow(PageError);

    const count = await prisma.adExpense.count({ where: { pageId: created.pageId } });
    expect(count).toBe(0);
  });

  it("rejects AdExpense for a non-existent Page", async () => {
    await expect(createAdExpense({ paidByAdminId: adminId, pageId: randomUUID(), expenseMonth: JAN, amount: 1_000n }, adminId)).rejects.toThrow(AdExpenseError);
  });
});

describe("updateAdExpense", () => {
  it("re-resolves the owner snapshot when pageId or expenseMonth changes", async () => {
    const pageOne = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-ads-update-1",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(pageOne.pageId);

    const pageTwo = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-ads-update-2",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
        assignEmployeeId: employeeBId,
      },
      adminId,
    );
    createdPageIds.push(pageTwo.pageId);

    const adExpense = await createAdExpense({ paidByAdminId: adminId, pageId: pageOne.pageId, expenseMonth: JAN, amount: 1_000_000n }, adminId);

    await updateAdExpense(adExpense.adExpenseId, { paidByAdminId: adminId, pageId: pageTwo.pageId, expenseMonth: FEB, amount: 2_000_000n, note: "moved" }, adminId);

    const row = await prisma.adExpense.findUniqueOrThrow({ where: { id: adExpense.adExpenseId } });
    expect(row.pageId).toBe(pageTwo.pageId);
    expect(row.employeeIdSnapshot).toBe(employeeBId);
    expect(row.amount).toBe(2_000_000n);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "AdExpense", entityId: adExpense.adExpenseId, action: "UPDATE" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects moving a record onto a Page+month that already has a different active record", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-ads-conflict",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    await createAdExpense({ paidByAdminId: adminId, pageId: created.pageId, expenseMonth: JAN, amount: 1_000_000n }, adminId);
    const febRow = await createAdExpense({ paidByAdminId: adminId, pageId: created.pageId, expenseMonth: FEB, amount: 2_000_000n }, adminId);

    await expect(
      updateAdExpense(febRow.adExpenseId, { paidByAdminId: adminId, pageId: created.pageId, expenseMonth: JAN, amount: 2_000_000n }, adminId),
    ).rejects.toThrow(AdExpenseError);
  });
});

describe("softDeleteAdExpense", () => {
  it("sets deletedAt, hides the row from listAdExpenses, and frees the Page+month for a new record", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-ads-delete",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    const adExpense = await createAdExpense({ paidByAdminId: adminId, pageId: created.pageId, expenseMonth: JAN, amount: 500_000n }, adminId);

    const beforeDelete = await listAdExpenses({ pageId: created.pageId });
    expect(beforeDelete.items.map((item) => item.adExpenseId)).toContain(adExpense.adExpenseId);

    await softDeleteAdExpense(adExpense.adExpenseId, adminId);

    const row = await prisma.adExpense.findUniqueOrThrow({ where: { id: adExpense.adExpenseId } });
    expect(row.deletedAt).not.toBeNull();

    const afterDelete = await listAdExpenses({ pageId: created.pageId });
    expect(afterDelete.items.map((item) => item.adExpenseId)).not.toContain(adExpense.adExpenseId);

    // Page+month is free again after soft delete — a new create is a fresh CREATE, not blocked by the deleted row.
    const recreated = await createAdExpense({ paidByAdminId: adminId, pageId: created.pageId, expenseMonth: JAN, amount: 700_000n }, adminId);
    expect(recreated.wasUpdate).toBe(false);
    expect(recreated.adExpenseId).not.toBe(adExpense.adExpenseId);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "AdExpense", entityId: adExpense.adExpenseId, action: "DELETE" },
    });
    expect(audit).not.toBeNull();
  });
});

describe("listAdExpenses filters", () => {
  it("filters by month, employee, and page", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-ads-filters",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    const inMonth = await createAdExpense({ paidByAdminId: adminId, pageId: created.pageId, expenseMonth: FEB, amount: 100_000n }, adminId);
    const outOfMonth = await createAdExpense({ paidByAdminId: adminId, pageId: created.pageId, expenseMonth: MAR, amount: 200_000n }, adminId);

    const filtered = await listAdExpenses({ month: "2026-02", pageId: created.pageId, employeeId: employeeAId });
    const ids = filtered.items.map((item) => item.adExpenseId);
    expect(ids).toContain(inMonth.adExpenseId);
    expect(ids).not.toContain(outOfMonth.adExpenseId);
  });
});
