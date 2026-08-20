import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee, getEmployeeFinancials } from "@/server/services/employee.service";
import {
  createAdminExpense,
  updateAdminExpense,
  softDeleteAdminExpense,
  restoreAdminExpense,
  listAdminExpenses,
  AdminExpenseError,
} from "@/server/services/admin-expense.service";
import { listAdminOptions } from "@/server/services/user-account.service";

let adminId: string;
const createdUserIds: string[] = [];
const createdExpenseIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (admin-expense-service)",
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;
  createdUserIds.push(admin.id);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityType: "AdminExpense", entityId: { in: createdExpenseIds } } });
  await prisma.adminExpense.deleteMany({ where: { id: { in: createdExpenseIds } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("createAdminExpense", () => {
  it("creates a record and writes an audit CREATE entry (spec §8, §19)", async () => {
    const result = await createAdminExpense(
      { paidByAdminId: adminId, expenseDate: new Date("2026-03-05"), amount: 2_000_000n, description: "Gia hạn server" },
      adminId,
    );
    createdExpenseIds.push(result.adminExpenseId);

    const row = await prisma.adminExpense.findUnique({ where: { id: result.adminExpenseId } });
    expect(row?.amount).toBe(2_000_000n);
    expect(row?.createdByAdminId).toBe(adminId);
    expect(row?.deletedAt).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "AdminExpense", entityId: result.adminExpenseId, action: "CREATE" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects an invalid payer, without creating an orphan record", async () => {
    await expect(
      createAdminExpense(
        { paidByAdminId: randomUUID(), expenseDate: new Date("2026-03-05"), amount: 1000n, description: "x" },
        adminId,
      ),
    ).rejects.toThrow(AdminExpenseError);
  });

  it("does NOT add to Employee Cost — AdminExpense only feeds Total Expenses, never Employee Cost (spec §8, §10.2/§10.3)", async () => {
    const employee = await createEmployee(
      { name: "Admin Expense Isolation Employee", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
      adminId,
    );
    createdUserIds.push(employee.userId);

    const before = await getEmployeeFinancials(employee.employeeId);
    const created = await createAdminExpense(
      { paidByAdminId: adminId, expenseDate: new Date("2026-03-05"), amount: 50_000_000n, description: "Should not touch employee cost" },
      adminId,
    );
    createdExpenseIds.push(created.adminExpenseId);
    const after = await getEmployeeFinancials(employee.employeeId);

    expect(after.totalCost).toBe(before.totalCost);
    expect(after.adsCost).toBe(before.adsCost);
    expect(after.pagePurchaseCost).toBe(before.pagePurchaseCost);
    expect(after.salaryCost).toBe(before.salaryCost);
  });
});

describe("updateAdminExpense", () => {
  it("updates fields and writes before/after audit UPDATE", async () => {
    const created = await createAdminExpense(
      { paidByAdminId: adminId, expenseDate: new Date("2026-04-01"), amount: 1_000_000n, description: "Original" },
      adminId,
    );
    createdExpenseIds.push(created.adminExpenseId);

    await updateAdminExpense(
      created.adminExpenseId,
      { paidByAdminId: adminId, expenseDate: new Date("2026-04-02"), amount: 3_000_000n, description: "Updated", note: "note" },
      adminId,
    );

    const row = await prisma.adminExpense.findUnique({ where: { id: created.adminExpenseId } });
    expect(row?.amount).toBe(3_000_000n);
    expect(row?.description).toBe("Updated");
    expect(row?.note).toBe("note");

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "AdminExpense", entityId: created.adminExpenseId, action: "UPDATE" },
    });
    expect((audit?.beforeJson as { amount: string })?.amount).toBe("1000000");
    expect((audit?.afterJson as { amount: string })?.amount).toBe("3000000");
  });

  it("rejects updating a soft-deleted record", async () => {
    const created = await createAdminExpense(
      { paidByAdminId: adminId, expenseDate: new Date("2026-04-05"), amount: 500_000n, description: "To delete" },
      adminId,
    );
    createdExpenseIds.push(created.adminExpenseId);
    await softDeleteAdminExpense(created.adminExpenseId, adminId);

    await expect(
      updateAdminExpense(
        created.adminExpenseId,
        { paidByAdminId: adminId, expenseDate: new Date("2026-04-05"), amount: 999n, description: "x" },
        adminId,
      ),
    ).rejects.toThrow(AdminExpenseError);
  });
});

describe("soft delete + restore (spec §19 'Restore nếu cần', §28)", () => {
  it("hides a deleted record from the default list but keeps it in DB, and restore brings it back", async () => {
    const created = await createAdminExpense(
      { paidByAdminId: adminId, expenseDate: new Date("2026-05-10"), amount: 4_000_000n, description: "Restorable" },
      adminId,
    );
    createdExpenseIds.push(created.adminExpenseId);

    await softDeleteAdminExpense(created.adminExpenseId, adminId);

    const activeList = await listAdminExpenses({ page: 1, pageSize: 100 });
    expect(activeList.items.some((i) => i.adminExpenseId === created.adminExpenseId)).toBe(false);

    const deletedList = await listAdminExpenses({ page: 1, pageSize: 100, deleted: true });
    expect(deletedList.items.some((i) => i.adminExpenseId === created.adminExpenseId)).toBe(true);

    const deleteAudit = await prisma.auditLog.findFirst({
      where: { entityType: "AdminExpense", entityId: created.adminExpenseId, action: "DELETE" },
    });
    expect(deleteAudit).not.toBeNull();

    await restoreAdminExpense(created.adminExpenseId, adminId);

    const row = await prisma.adminExpense.findUnique({ where: { id: created.adminExpenseId } });
    expect(row?.deletedAt).toBeNull();

    const restoredActiveList = await listAdminExpenses({ page: 1, pageSize: 100 });
    expect(restoredActiveList.items.some((i) => i.adminExpenseId === created.adminExpenseId)).toBe(true);

    const restoreAudit = await prisma.auditLog.findFirst({
      where: { entityType: "AdminExpense", entityId: created.adminExpenseId, action: "RESTORE" },
    });
    expect(restoreAudit).not.toBeNull();
  });

  it("rejects restoring a record that isn't deleted", async () => {
    const created = await createAdminExpense(
      { paidByAdminId: adminId, expenseDate: new Date("2026-05-11"), amount: 100_000n, description: "Never deleted" },
      adminId,
    );
    createdExpenseIds.push(created.adminExpenseId);

    await expect(restoreAdminExpense(created.adminExpenseId, adminId)).rejects.toThrow(AdminExpenseError);
  });
});

describe("listAdminExpenses filters", () => {
  it("filters by month and by createdByAdminId (spec §13)", async () => {
    const otherAdmin = await prisma.user.create({
      data: {
        name: "Other Test Admin (admin-expense-service)",
        email: `test-admin-${randomUUID()}@example.test`,
        passwordHash: "x",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    createdUserIds.push(otherAdmin.id);

    const juneByFirstAdmin = await createAdminExpense(
      { paidByAdminId: adminId, expenseDate: new Date("2026-06-15"), amount: 111n, description: "June, admin 1" },
      adminId,
    );
    createdExpenseIds.push(juneByFirstAdmin.adminExpenseId);

    const julyByFirstAdmin = await createAdminExpense(
      { paidByAdminId: adminId, expenseDate: new Date("2026-07-15"), amount: 222n, description: "July, admin 1" },
      adminId,
    );
    createdExpenseIds.push(julyByFirstAdmin.adminExpenseId);

    const juneByOtherAdmin = await createAdminExpense(
      { paidByAdminId: adminId, expenseDate: new Date("2026-06-20"), amount: 333n, description: "June, admin 2" },
      otherAdmin.id,
    );
    createdExpenseIds.push(juneByOtherAdmin.adminExpenseId);

    const juneOnly = await listAdminExpenses({ month: "2026-06", page: 1, pageSize: 100 });
    const juneIds = juneOnly.items.map((i) => i.adminExpenseId);
    expect(juneIds).toContain(juneByFirstAdmin.adminExpenseId);
    expect(juneIds).toContain(juneByOtherAdmin.adminExpenseId);
    expect(juneIds).not.toContain(julyByFirstAdmin.adminExpenseId);

    const byOtherAdmin = await listAdminExpenses({ createdByAdminId: otherAdmin.id, page: 1, pageSize: 100 });
    const otherAdminIds = byOtherAdmin.items.map((i) => i.adminExpenseId);
    expect(otherAdminIds).toEqual([juneByOtherAdmin.adminExpenseId]);
  });
});

describe("listAdminOptions", () => {
  it("returns ADMIN-role users for the 'Admin đã nhập' filter", async () => {
    const options = await listAdminOptions();
    expect(options.some((o) => o.adminId === adminId)).toBe(true);
  });
});
