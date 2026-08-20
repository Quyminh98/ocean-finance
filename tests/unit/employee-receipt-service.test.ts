import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee, getEmployeeFinancials } from "@/server/services/employee.service";
import {
  createEmployeeReceipt,
  updateEmployeeReceipt,
  softDeleteEmployeeReceipt,
  listEmployeeReceipts,
  EmployeeReceiptError,
} from "@/server/services/employee-receipt.service";

let adminId: string;
let employeeAId: string;
let employeeBId: string;
const createdUserIds: string[] = [];
const createdReceiptIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (employee-receipt-service)",
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;
  createdUserIds.push(admin.id);

  const employeeA = await createEmployee(
    { name: "Employee Receipt A", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeAId = employeeA.employeeId;
  createdUserIds.push(employeeA.userId);

  const employeeB = await createEmployee(
    { name: "Employee Receipt B", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeBId = employeeB.employeeId;
  createdUserIds.push(employeeB.userId);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityType: "EmployeeReceipt", entityId: { in: createdReceiptIds } } });
  await prisma.employeeReceipt.deleteMany({ where: { id: { in: createdReceiptIds } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("createEmployeeReceipt", () => {
  it("creates a record and writes an audit CREATE entry", async () => {
    const result = await createEmployeeReceipt(
      { employeeId: employeeAId, receiptMonth: new Date("2026-03-01"), amount: 5_000_000n, note: "Lương tháng 3" },
      adminId,
    );
    createdReceiptIds.push(result.employeeReceiptId);
    expect(result.wasUpdate).toBe(false);

    const row = await prisma.employeeReceipt.findUniqueOrThrow({ where: { id: result.employeeReceiptId } });
    expect(row.amount).toBe(5_000_000n);
    expect(row.employeeId).toBe(employeeAId);
    expect(row.createdByAdminId).toBe(adminId);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "EmployeeReceipt", entityId: result.employeeReceiptId, action: "CREATE" },
    });
    expect(audit).not.toBeNull();
  });

  it("overwrites amount/note when re-submitted for the same employee+month, instead of creating a second row", async () => {
    const first = await createEmployeeReceipt(
      { employeeId: employeeBId, receiptMonth: new Date("2026-04-01"), amount: 1_000_000n },
      adminId,
    );
    createdReceiptIds.push(first.employeeReceiptId);
    expect(first.wasUpdate).toBe(false);

    const second = await createEmployeeReceipt(
      { employeeId: employeeBId, receiptMonth: new Date("2026-04-01"), amount: 2_000_000n, note: "Đã sửa" },
      adminId,
    );
    expect(second.wasUpdate).toBe(true);
    expect(second.employeeReceiptId).toBe(first.employeeReceiptId);

    const row = await prisma.employeeReceipt.findUniqueOrThrow({ where: { id: first.employeeReceiptId } });
    expect(row.amount).toBe(2_000_000n);
    expect(row.note).toBe("Đã sửa");

    const count = await prisma.employeeReceipt.count({ where: { employeeId: employeeBId, receiptMonth: new Date("2026-04-01") } });
    expect(count).toBe(1);
  });

  it("rejects an unknown employee, without creating an orphan record", async () => {
    await expect(
      createEmployeeReceipt({ employeeId: randomUUID(), receiptMonth: new Date("2026-03-01"), amount: 1000n }, adminId),
    ).rejects.toThrow(EmployeeReceiptError);
  });

  it("does NOT affect Employee Cost/Revenue — purely a viewing record (user request 2026-08-18)", async () => {
    const before = await getEmployeeFinancials(employeeAId);
    const created = await createEmployeeReceipt(
      { employeeId: employeeAId, receiptMonth: new Date("2026-05-01"), amount: 99_000_000n },
      adminId,
    );
    createdReceiptIds.push(created.employeeReceiptId);
    const after = await getEmployeeFinancials(employeeAId);

    expect(after.totalCost).toBe(before.totalCost);
    expect(after.revenue).toBe(before.revenue);
    expect(after.adsCost).toBe(before.adsCost);
    expect(after.pagePurchaseCost).toBe(before.pagePurchaseCost);
    expect(after.salaryCost).toBe(before.salaryCost);
  });
});

describe("updateEmployeeReceipt", () => {
  it("updates fields and writes before/after audit UPDATE", async () => {
    const created = await createEmployeeReceipt(
      { employeeId: employeeAId, receiptMonth: new Date("2026-06-01"), amount: 1_000_000n },
      adminId,
    );
    createdReceiptIds.push(created.employeeReceiptId);

    await updateEmployeeReceipt(
      created.employeeReceiptId,
      { employeeId: employeeAId, receiptMonth: new Date("2026-06-01"), amount: 3_000_000n, note: "Updated" },
      adminId,
    );

    const row = await prisma.employeeReceipt.findUniqueOrThrow({ where: { id: created.employeeReceiptId } });
    expect(row.amount).toBe(3_000_000n);
    expect(row.note).toBe("Updated");

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "EmployeeReceipt", entityId: created.employeeReceiptId, action: "UPDATE" },
    });
    expect((audit?.beforeJson as { amount: string })?.amount).toBe("1000000");
    expect((audit?.afterJson as { amount: string })?.amount).toBe("3000000");
  });

  it("rejects moving a record onto an employee+month that already has a different active record", async () => {
    const a = await createEmployeeReceipt({ employeeId: employeeAId, receiptMonth: new Date("2026-07-01"), amount: 1n }, adminId);
    createdReceiptIds.push(a.employeeReceiptId);
    const b = await createEmployeeReceipt({ employeeId: employeeAId, receiptMonth: new Date("2026-08-01"), amount: 2n }, adminId);
    createdReceiptIds.push(b.employeeReceiptId);

    await expect(
      updateEmployeeReceipt(b.employeeReceiptId, { employeeId: employeeAId, receiptMonth: new Date("2026-07-01"), amount: 2n }, adminId),
    ).rejects.toThrow(EmployeeReceiptError);
  });
});

describe("softDeleteEmployeeReceipt", () => {
  it("hides the row from listEmployeeReceipts' default view and writes an audit DELETE entry", async () => {
    const created = await createEmployeeReceipt(
      { employeeId: employeeBId, receiptMonth: new Date("2026-09-01"), amount: 500_000n },
      adminId,
    );
    createdReceiptIds.push(created.employeeReceiptId);

    await softDeleteEmployeeReceipt(created.employeeReceiptId, adminId);

    const listed = await listEmployeeReceipts({ employeeId: employeeBId });
    expect(listed.items.map((item) => item.employeeReceiptId)).not.toContain(created.employeeReceiptId);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "EmployeeReceipt", entityId: created.employeeReceiptId, action: "DELETE" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects deleting an already-deleted (or non-existent) record", async () => {
    const created = await createEmployeeReceipt(
      { employeeId: employeeBId, receiptMonth: new Date("2026-10-01"), amount: 500_000n },
      adminId,
    );
    createdReceiptIds.push(created.employeeReceiptId);

    await softDeleteEmployeeReceipt(created.employeeReceiptId, adminId);
    await expect(softDeleteEmployeeReceipt(created.employeeReceiptId, adminId)).rejects.toThrow(EmployeeReceiptError);
    await expect(softDeleteEmployeeReceipt(randomUUID(), adminId)).rejects.toThrow(EmployeeReceiptError);
  });
});

describe("listEmployeeReceipts filters", () => {
  it("filters by month and by employeeId", async () => {
    const juneA = await createEmployeeReceipt({ employeeId: employeeAId, receiptMonth: new Date("2026-11-01"), amount: 111n }, adminId);
    createdReceiptIds.push(juneA.employeeReceiptId);
    const julyA = await createEmployeeReceipt({ employeeId: employeeAId, receiptMonth: new Date("2026-12-01"), amount: 222n }, adminId);
    createdReceiptIds.push(julyA.employeeReceiptId);
    const juneB = await createEmployeeReceipt({ employeeId: employeeBId, receiptMonth: new Date("2026-11-01"), amount: 333n }, adminId);
    createdReceiptIds.push(juneB.employeeReceiptId);

    const byMonth = await listEmployeeReceipts({ month: "2026-11" });
    const monthIds = byMonth.items.map((item) => item.employeeReceiptId);
    expect(monthIds).toContain(juneA.employeeReceiptId);
    expect(monthIds).toContain(juneB.employeeReceiptId);
    expect(monthIds).not.toContain(julyA.employeeReceiptId);

    const byEmployee = await listEmployeeReceipts({ employeeId: employeeAId });
    const employeeIds = byEmployee.items.map((item) => item.employeeReceiptId);
    expect(employeeIds).toContain(juneA.employeeReceiptId);
    expect(employeeIds).toContain(julyA.employeeReceiptId);
    expect(employeeIds).not.toContain(juneB.employeeReceiptId);
  });
});
