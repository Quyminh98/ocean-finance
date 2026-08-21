import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee } from "@/server/services/employee.service";
import { createPage, PageError } from "@/server/services/page.service";
import { transferPage, getAssignmentHistory } from "@/server/services/assignment.service";

let adminId: string;
let employeeAId: string;
let employeeBId: string;
let employeeInactiveId: string;
const createdUserIds: string[] = [];
const createdPageIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (page-transfer-flow)",
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;
  createdUserIds.push(admin.id);

  const employeeA = await createEmployee(
    { name: "Employee A", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeAId = employeeA.employeeId;
  createdUserIds.push(employeeA.userId);

  const employeeB = await createEmployee(
    { name: "Employee B", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeBId = employeeB.employeeId;
  createdUserIds.push(employeeB.userId);

  const employeeInactive = await createEmployee(
    { name: "Employee Inactive", email: `test-employee-${randomUUID()}@example.test`, status: "INACTIVE" },
    adminId,
  );
  employeeInactiveId = employeeInactive.employeeId;
  createdUserIds.push(employeeInactive.userId);
});

afterAll(async () => {
  // AuditLog has no FK on entityId (free-form, spec §29) — deleting the
  // Page/Employee fixtures below wouldn't clean these up on its own, and
  // they'd otherwise sit in the shared dev DB as orphaned TRANSFER/CREATE
  // rows forever, polluting Admin Dashboard "Lịch sử thao tác".
  await prisma.auditLog.deleteMany({
    where: { entityId: { in: [...createdPageIds, employeeAId, employeeBId, employeeInactiveId] } },
  });
  await prisma.pagePurchaseExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pageAssignment.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.page.deleteMany({ where: { id: { in: createdPageIds } } });
  await prisma.salaryHistory.deleteMany({ where: { employee: { userId: { in: createdUserIds } } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("Transfer Page (spec §52 Integration Test Case 2 — Purchase price)", () => {
  it("closes the old assignment, opens a new one, and reassigns PagePurchaseExpense to the new owner", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-transfer",
        purchasePrice: 5_000_000n,
        purchaseMonth: new Date("2026-01-05"),
        assignEmployeeId: employeeAId,
        paidByAdminId: adminId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    await transferPage(
      created.pageId,
      { newEmployeeId: employeeBId, effectiveDate: new Date("2026-05-16"), note: "handover" },
      adminId,
    );

    const history = await getAssignmentHistory(created.pageId);
    expect(history).toHaveLength(2);

    const closed = history.find((row) => row.employeeId === employeeAId);
    const opened = history.find((row) => row.employeeId === employeeBId);
    expect(closed?.endedAt?.toISOString().slice(0, 10)).toBe("2026-05-16");
    expect(opened?.startedAt.toISOString().slice(0, 10)).toBe("2026-05-16");
    expect(opened?.endedAt).toBeNull();

    // Case 2 (reversed 2026-08-21, user request "chi phí cũ thì lại chuyển sang cho người B"):
    // B now owns the Page Purchase cost — A no longer does. Unlike Revenue, this is the one
    // deliberate exception to the snapshot-never-moves rule (see CLAUDE.md).
    const purchaseExpense = await prisma.pagePurchaseExpense.findUnique({ where: { pageId: created.pageId } });
    expect(purchaseExpense?.employeeIdSnapshot).toBe(employeeBId);
    expect(purchaseExpense?.assignmentIdSnapshot).toBe(opened?.id);
    expect(purchaseExpense?.amount).toBe(5_000_000n);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Page", entityId: created.pageId, action: "TRANSFER" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects transferring to an INACTIVE employee (spec §43 'Page transfer')", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-transfer-inactive",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    await expect(
      transferPage(created.pageId, { newEmployeeId: employeeInactiveId, effectiveDate: new Date("2026-02-01") }, adminId),
    ).rejects.toThrow(PageError);

    // Active assignment must be untouched by the rejected attempt.
    const activeAssignment = await prisma.pageAssignment.findFirst({ where: { pageId: created.pageId, endedAt: null } });
    expect(activeAssignment?.employeeId).toBe(employeeAId);
  });

  it("rejects an effective date at or before the current assignment's start date", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-transfer-invalid-date",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    await expect(
      transferPage(created.pageId, { newEmployeeId: employeeBId, effectiveDate: new Date("2026-01-05") }, adminId),
    ).rejects.toThrow(PageError);
    await expect(
      transferPage(created.pageId, { newEmployeeId: employeeBId, effectiveDate: new Date("2026-01-01") }, adminId),
    ).rejects.toThrow(PageError);
  });

  it("keeps assignment intervals non-overlapping at the database level after a successful transfer", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-transfer-overlap",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    await transferPage(created.pageId, { newEmployeeId: employeeBId, effectiveDate: new Date("2026-03-01") }, adminId);

    const activeAssignments = await prisma.pageAssignment.findMany({ where: { pageId: created.pageId, endedAt: null } });
    expect(activeAssignments).toHaveLength(1);
    expect(activeAssignments[0].employeeId).toBe(employeeBId);
  });
});
