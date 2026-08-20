import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee } from "@/server/services/employee.service";
import { createPage, PageError } from "@/server/services/page.service";
import { assignEmployee, getAssignmentHistory } from "@/server/services/assignment.service";

let adminId: string;
let employeeAId: string;
let employeeBId: string;
let employeeInactiveId: string;
const createdUserIds: string[] = [];
const createdPageIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (assign-employee)",
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
  await prisma.pagePurchaseExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pageAssignment.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.page.deleteMany({ where: { id: { in: createdPageIds } } });
  await prisma.salaryHistory.deleteMany({ where: { employee: { userId: { in: createdUserIds } } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("createPage without an employee", () => {
  it("creates a bare Page with no assignment and no PagePurchaseExpense, but stores paidByAdminId on the Page for later reuse (purchasePrice > 0)", async () => {
    const result = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-unassigned",
        purchasePrice: 5_000_000n,
        purchaseMonth: new Date("2026-01-05"),
        paidByAdminId: adminId,
      },
      adminId,
    );
    createdPageIds.push(result.pageId);

    const assignment = await prisma.pageAssignment.findFirst({ where: { pageId: result.pageId } });
    expect(assignment).toBeNull();

    const purchaseExpense = await prisma.pagePurchaseExpense.findUnique({ where: { pageId: result.pageId } });
    expect(purchaseExpense).toBeNull();

    const page = await prisma.page.findUniqueOrThrow({ where: { id: result.pageId } });
    expect(page.paidByAdminId).toBe(adminId);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Page", entityId: result.pageId, action: "CREATE" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects creating a Page with purchasePrice > 0 and no paidByAdminId, even without assigning an employee (user request 2026-08-18)", async () => {
    await expect(
      createPage(
        {
          name: `Test Page ${randomUUID()}`,
          facebookUrl: "https://facebook.com/test-unassigned-missing-payer",
          purchasePrice: 2_000_000n,
          purchaseMonth: new Date("2026-01-05"),
        },
        adminId,
      ),
    ).rejects.toThrow(PageError);

    const orphanCount = await prisma.page.count({ where: { facebookUrl: { contains: "test-unassigned-missing-payer" } } });
    expect(orphanCount).toBe(0);
  });
});

describe("assignEmployee (first-time assignment)", () => {
  it("assigns the employee and, deferred from creation, snapshots the PagePurchaseExpense to them (spec §15.4a)", async () => {
    const page = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-deferred-purchase",
        purchasePrice: 7_500_000n,
        purchaseMonth: new Date("2026-02-01"),
        paidByAdminId: adminId,
      },
      adminId,
    );
    createdPageIds.push(page.pageId);

    await assignEmployee(page.pageId, { employeeId: employeeAId, effectiveDate: new Date("2026-03-10") }, adminId);

    const history = await getAssignmentHistory(page.pageId);
    expect(history).toHaveLength(1);
    expect(history[0].employeeId).toBe(employeeAId);
    expect(history[0].startedAt.toISOString().slice(0, 10)).toBe("2026-03-10");
    expect(history[0].endedAt).toBeNull();

    const purchaseExpense = await prisma.pagePurchaseExpense.findUnique({ where: { pageId: page.pageId } });
    expect(purchaseExpense?.employeeIdSnapshot).toBe(employeeAId);
    expect(purchaseExpense?.amount).toBe(7_500_000n);
    expect(purchaseExpense?.paidByAdminId).toBe(adminId);
    // Purchase date stays the Page's actual purchase date, not the (later) assignment effective date.
    expect(purchaseExpense?.purchaseMonth.toISOString().slice(0, 10)).toBe("2026-02-01");

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Page", entityId: page.pageId, action: "ASSIGN" },
    });
    expect(audit).not.toBeNull();
  });

  it("does not create a PagePurchaseExpense when purchasePrice = 0", async () => {
    const page = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-deferred-free",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-02-01"),
      },
      adminId,
    );
    createdPageIds.push(page.pageId);

    await assignEmployee(page.pageId, { employeeId: employeeAId, effectiveDate: new Date("2026-03-10") }, adminId);

    const purchaseExpense = await prisma.pagePurchaseExpense.findUnique({ where: { pageId: page.pageId } });
    expect(purchaseExpense).toBeNull();
  });

  it("rejects when the Page already has an active assignment (must use Transfer instead)", async () => {
    const page = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-already-assigned",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(page.pageId);

    await expect(
      assignEmployee(page.pageId, { employeeId: employeeBId, effectiveDate: new Date("2026-02-01") }, adminId),
    ).rejects.toThrow(PageError);

    const history = await getAssignmentHistory(page.pageId);
    expect(history).toHaveLength(1);
    expect(history[0].employeeId).toBe(employeeAId);
  });

  it("rejects assigning an INACTIVE employee", async () => {
    const page = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-assign-inactive",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
      },
      adminId,
    );
    createdPageIds.push(page.pageId);

    await expect(
      assignEmployee(page.pageId, { employeeId: employeeInactiveId, effectiveDate: new Date("2026-02-01") }, adminId),
    ).rejects.toThrow(PageError);

    const history = await getAssignmentHistory(page.pageId);
    expect(history).toHaveLength(0);
  });
});
