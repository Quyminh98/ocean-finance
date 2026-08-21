import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee } from "@/server/services/employee.service";
import {
  createAdExpense,
  updateAdExpense,
  softDeleteAdExpense,
  listAdExpenses,
  parseMonthKey,
  AdExpenseError,
} from "@/server/services/ads.service";

let adminId: string;
let employeeAId: string;
let employeeBId: string;
const createdUserIds: string[] = [];
const createdAdExpenseIds: string[] = [];

// Each test uses its own month for employeeA/employeeB so upsert-overwrite
// behavior (intended for same employee+month re-submission) never
// accidentally links two unrelated tests together.
const M = (key: string) => parseMonthKey(key)!;

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
  await prisma.auditLog.deleteMany({ where: { entityType: "AdExpense", entityId: { in: createdAdExpenseIds } } });
  await prisma.adExpense.deleteMany({ where: { id: { in: createdAdExpenseIds } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("createAdExpense", () => {
  it("creates a record directly for the given employee (user request 2026-08-20: Ads by employee, not Page)", async () => {
    const adExpense = await createAdExpense(
      { paidByAdminId: adminId, employeeId: employeeAId, expenseMonth: M("2026-01"), amount: 1_000_000n, note: "Tháng 1" },
      adminId,
    );
    createdAdExpenseIds.push(adExpense.adExpenseId);
    expect(adExpense.wasUpdate).toBe(false);

    const row = await prisma.adExpense.findUniqueOrThrow({ where: { id: adExpense.adExpenseId } });
    expect(row.employeeId).toBe(employeeAId);
    expect(row.amount).toBe(1_000_000n);
    expect(row.expenseMonth.toISOString().slice(0, 10)).toBe("2026-01-01");

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "AdExpense", entityId: adExpense.adExpenseId, action: "CREATE" },
    });
    expect(audit).not.toBeNull();
  });

  it("overwrites the existing month's amount instead of creating a 2nd row for the same employee+month", async () => {
    const first = await createAdExpense({ paidByAdminId: adminId, employeeId: employeeAId, expenseMonth: M("2026-02"), amount: 1_000_000n }, adminId);
    createdAdExpenseIds.push(first.adExpenseId);
    const second = await createAdExpense(
      { paidByAdminId: adminId, employeeId: employeeAId, expenseMonth: M("2026-02"), amount: 2_500_000n, note: "updated" },
      adminId,
    );

    expect(second.wasUpdate).toBe(true);
    expect(second.adExpenseId).toBe(first.adExpenseId);

    const count = await prisma.adExpense.count({ where: { employeeId: employeeAId, expenseMonth: M("2026-02"), deletedAt: null } });
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

  it("rejects AdExpense for a non-existent employee", async () => {
    await expect(
      createAdExpense({ paidByAdminId: adminId, employeeId: randomUUID(), expenseMonth: M("2026-03"), amount: 1_000n }, adminId),
    ).rejects.toThrow(AdExpenseError);
  });

  it("rejects an invalid payer (not an Admin)", async () => {
    await expect(
      createAdExpense({ paidByAdminId: employeeAId, employeeId: employeeAId, expenseMonth: M("2026-03"), amount: 1_000n }, adminId),
    ).rejects.toThrow(AdExpenseError);

    const count = await prisma.adExpense.count({ where: { employeeId: employeeAId, expenseMonth: M("2026-03") } });
    expect(count).toBe(0);
  });
});

describe("updateAdExpense", () => {
  it("moves a record to a different employee", async () => {
    const adExpense = await createAdExpense({ paidByAdminId: adminId, employeeId: employeeAId, expenseMonth: M("2026-04"), amount: 1_000_000n }, adminId);
    createdAdExpenseIds.push(adExpense.adExpenseId);

    await updateAdExpense(
      adExpense.adExpenseId,
      { paidByAdminId: adminId, employeeId: employeeBId, expenseMonth: M("2026-04"), amount: 2_000_000n, note: "moved" },
      adminId,
    );

    const row = await prisma.adExpense.findUniqueOrThrow({ where: { id: adExpense.adExpenseId } });
    expect(row.employeeId).toBe(employeeBId);
    expect(row.amount).toBe(2_000_000n);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "AdExpense", entityId: adExpense.adExpenseId, action: "UPDATE" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects moving a record onto an employee+month that already has a different active record", async () => {
    const mayRow = await createAdExpense({ paidByAdminId: adminId, employeeId: employeeAId, expenseMonth: M("2026-05"), amount: 1_000_000n }, adminId);
    createdAdExpenseIds.push(mayRow.adExpenseId);
    const juneRow = await createAdExpense({ paidByAdminId: adminId, employeeId: employeeAId, expenseMonth: M("2026-06"), amount: 2_000_000n }, adminId);
    createdAdExpenseIds.push(juneRow.adExpenseId);

    await expect(
      updateAdExpense(juneRow.adExpenseId, { paidByAdminId: adminId, employeeId: employeeAId, expenseMonth: M("2026-05"), amount: 2_000_000n }, adminId),
    ).rejects.toThrow(AdExpenseError);
  });
});

describe("softDeleteAdExpense", () => {
  it("sets deletedAt, hides the row from listAdExpenses, and frees the employee+month for a new record", async () => {
    const adExpense = await createAdExpense({ paidByAdminId: adminId, employeeId: employeeBId, expenseMonth: M("2026-07"), amount: 500_000n }, adminId);
    createdAdExpenseIds.push(adExpense.adExpenseId);

    const beforeDelete = await listAdExpenses({ employeeId: employeeBId, month: "2026-07" });
    expect(beforeDelete.items.map((item) => item.adExpenseId)).toContain(adExpense.adExpenseId);

    await softDeleteAdExpense(adExpense.adExpenseId, adminId);

    const row = await prisma.adExpense.findUniqueOrThrow({ where: { id: adExpense.adExpenseId } });
    expect(row.deletedAt).not.toBeNull();

    const afterDelete = await listAdExpenses({ employeeId: employeeBId, month: "2026-07" });
    expect(afterDelete.items.map((item) => item.adExpenseId)).not.toContain(adExpense.adExpenseId);

    // Employee+month is free again after soft delete — a new create is a fresh CREATE, not blocked by the deleted row.
    const recreated = await createAdExpense({ paidByAdminId: adminId, employeeId: employeeBId, expenseMonth: M("2026-07"), amount: 700_000n }, adminId);
    createdAdExpenseIds.push(recreated.adExpenseId);
    expect(recreated.wasUpdate).toBe(false);
    expect(recreated.adExpenseId).not.toBe(adExpense.adExpenseId);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "AdExpense", entityId: adExpense.adExpenseId, action: "DELETE" },
    });
    expect(audit).not.toBeNull();
  });
});

describe("listAdExpenses filters", () => {
  it("filters by month and employee", async () => {
    const inMonth = await createAdExpense({ paidByAdminId: adminId, employeeId: employeeAId, expenseMonth: M("2026-08"), amount: 100_000n }, adminId);
    createdAdExpenseIds.push(inMonth.adExpenseId);
    const outOfMonth = await createAdExpense({ paidByAdminId: adminId, employeeId: employeeAId, expenseMonth: M("2026-09"), amount: 200_000n }, adminId);
    createdAdExpenseIds.push(outOfMonth.adExpenseId);

    const filtered = await listAdExpenses({ month: "2026-08", employeeId: employeeAId });
    const ids = filtered.items.map((item) => item.adExpenseId);
    expect(ids).toContain(inMonth.adExpenseId);
    expect(ids).not.toContain(outOfMonth.adExpenseId);
  });

  it("filters by paidByAdminId", async () => {
    const otherAdmin = await prisma.user.create({
      data: {
        name: "Ads Other Admin",
        email: `test-admin-${randomUUID()}@example.test`,
        passwordHash: "x",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    createdUserIds.push(otherAdmin.id);

    const paidByOther = await createAdExpense(
      { paidByAdminId: otherAdmin.id, employeeId: employeeAId, expenseMonth: M("2026-10"), amount: 50_000n },
      adminId,
    );
    createdAdExpenseIds.push(paidByOther.adExpenseId);

    const filtered = await listAdExpenses({ paidByAdminId: otherAdmin.id });
    expect(filtered.items.map((item) => item.adExpenseId)).toContain(paidByOther.adExpenseId);
  });
});
