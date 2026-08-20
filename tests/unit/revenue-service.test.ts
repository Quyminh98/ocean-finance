import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee } from "@/server/services/employee.service";
import { createPage } from "@/server/services/page.service";
import { createRevenue, updateRevenue, softDeleteRevenue, listRevenue, RevenueError } from "@/server/services/revenue.service";
import { PageError } from "@/server/services/page.service";

let adminId: string;
let employeeAId: string;
let employeeBId: string;
const createdUserIds: string[] = [];
const createdPageIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (revenue-service)",
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;
  createdUserIds.push(admin.id);

  const employeeA = await createEmployee(
    { name: "Revenue Employee A", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeAId = employeeA.employeeId;
  createdUserIds.push(employeeA.userId);

  const employeeB = await createEmployee(
    { name: "Revenue Employee B", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeBId = employeeB.employeeId;
  createdUserIds.push(employeeB.userId);
});

afterAll(async () => {
  await prisma.revenue.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pagePurchaseExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pageAssignment.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.page.deleteMany({ where: { id: { in: createdPageIds } } });
  await prisma.salaryHistory.deleteMany({ where: { employee: { userId: { in: createdUserIds } } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("createRevenue", () => {
  it("snapshots the employee currently assigned to the Page (spec §4.2)", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-revenue-snapshot",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    const revenue = await createRevenue(
      { pageId: created.pageId, revenueMonth: new Date("2026-01-01"), amount: 10_000_000n, note: "Tuần 1" },
      adminId,
    );
    expect(revenue.wasUpdate).toBe(false);

    const row = await prisma.revenue.findUniqueOrThrow({ where: { id: revenue.revenueId } });
    expect(row.employeeIdSnapshot).toBe(employeeAId);
    expect(row.amount).toBe(10_000_000n);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Revenue", entityId: revenue.revenueId, action: "CREATE" },
    });
    expect(audit).not.toBeNull();
  });

  it("overwrites the existing month's amount instead of creating a 2nd row for the same Page+month (user request 2026-08-18)", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-revenue-upsert",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    const first = await createRevenue({ pageId: created.pageId, revenueMonth: new Date("2026-01-01"), amount: 10_000_000n }, adminId);
    const second = await createRevenue(
      { pageId: created.pageId, revenueMonth: new Date("2026-01-01"), amount: 25_000_000n, note: "updated" },
      adminId,
    );

    expect(second.wasUpdate).toBe(true);
    expect(second.revenueId).toBe(first.revenueId);

    const count = await prisma.revenue.count({ where: { pageId: created.pageId, deletedAt: null } });
    expect(count).toBe(1);

    const row = await prisma.revenue.findUniqueOrThrow({ where: { id: first.revenueId } });
    expect(row.amount).toBe(25_000_000n);
    expect(row.note).toBe("updated");

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Revenue", entityId: first.revenueId, action: "UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects creating Revenue for a Page with no valid assignment at the given date (spec §17)", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-revenue-no-owner",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    await expect(
      createRevenue({ pageId: created.pageId, revenueMonth: new Date("2026-01-01"), amount: 5_000_000n }, adminId),
    ).rejects.toThrow(PageError);

    const count = await prisma.revenue.count({ where: { pageId: created.pageId } });
    expect(count).toBe(0);
  });

  it("rejects Revenue for a non-existent Page", async () => {
    await expect(
      createRevenue({ pageId: randomUUID(), revenueMonth: new Date("2026-01-01"), amount: 1_000n }, adminId),
    ).rejects.toThrow(RevenueError);
  });
});

describe("updateRevenue", () => {
  it("re-resolves the owner snapshot when pageId or revenueMonth changes", async () => {
    const pageOne = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-revenue-update-1",
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
        facebookUrl: "https://facebook.com/test-revenue-update-2",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
        assignEmployeeId: employeeBId,
      },
      adminId,
    );
    createdPageIds.push(pageTwo.pageId);

    const revenue = await createRevenue(
      { pageId: pageOne.pageId, revenueMonth: new Date("2026-01-01"), amount: 10_000_000n },
      adminId,
    );

    await updateRevenue(
      revenue.revenueId,
      { pageId: pageTwo.pageId, revenueMonth: new Date("2026-01-01"), amount: 20_000_000n, note: "moved" },
      adminId,
    );

    const row = await prisma.revenue.findUniqueOrThrow({ where: { id: revenue.revenueId } });
    expect(row.pageId).toBe(pageTwo.pageId);
    expect(row.employeeIdSnapshot).toBe(employeeBId);
    expect(row.amount).toBe(20_000_000n);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Revenue", entityId: revenue.revenueId, action: "UPDATE" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects moving a record onto a Page+month that already has a different active record", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-revenue-conflict",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    await createRevenue({ pageId: created.pageId, revenueMonth: new Date("2026-01-01"), amount: 10_000_000n }, adminId);
    const febRow = await createRevenue({ pageId: created.pageId, revenueMonth: new Date("2026-02-01"), amount: 5_000_000n }, adminId);

    await expect(
      updateRevenue(febRow.revenueId, { pageId: created.pageId, revenueMonth: new Date("2026-01-01"), amount: 5_000_000n }, adminId),
    ).rejects.toThrow(RevenueError);
  });
});

describe("softDeleteRevenue", () => {
  it("sets deletedAt, hides the row from listRevenue's default (non-deleted) view, and frees the Page+month for a new record", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-revenue-delete",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    const revenue = await createRevenue(
      { pageId: created.pageId, revenueMonth: new Date("2026-01-01"), amount: 5_000_000n },
      adminId,
    );

    const beforeDelete = await listRevenue({ pageId: created.pageId });
    expect(beforeDelete.items.map((item) => item.revenueId)).toContain(revenue.revenueId);

    await softDeleteRevenue(revenue.revenueId, adminId);

    const row = await prisma.revenue.findUniqueOrThrow({ where: { id: revenue.revenueId } });
    expect(row.deletedAt).not.toBeNull();

    const afterDelete = await listRevenue({ pageId: created.pageId });
    expect(afterDelete.items.map((item) => item.revenueId)).not.toContain(revenue.revenueId);

    // Page+month is free again after soft delete — a new create is a fresh CREATE, not blocked by the deleted row.
    const recreated = await createRevenue({ pageId: created.pageId, revenueMonth: new Date("2026-01-01"), amount: 7_000_000n }, adminId);
    expect(recreated.wasUpdate).toBe(false);
    expect(recreated.revenueId).not.toBe(revenue.revenueId);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Revenue", entityId: revenue.revenueId, action: "DELETE" },
    });
    expect(audit).not.toBeNull();
  });
});

describe("listRevenue filters", () => {
  it("filters by month, employee, and page", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-revenue-filters",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    const inMonth = await createRevenue(
      { pageId: created.pageId, revenueMonth: new Date("2026-02-01"), amount: 1_000_000n },
      adminId,
    );
    const outOfMonth = await createRevenue(
      { pageId: created.pageId, revenueMonth: new Date("2026-03-01"), amount: 2_000_000n },
      adminId,
    );

    const filtered = await listRevenue({ month: "2026-02", pageId: created.pageId, employeeId: employeeAId });
    const ids = filtered.items.map((item) => item.revenueId);
    expect(ids).toContain(inMonth.revenueId);
    expect(ids).not.toContain(outOfMonth.revenueId);
  });
});
