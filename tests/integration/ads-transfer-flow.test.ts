import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee } from "@/server/services/employee.service";
import { createPage } from "@/server/services/page.service";
import { transferPage } from "@/server/services/assignment.service";
import { createAdExpense, parseMonthKey } from "@/server/services/ads.service";

let adminId: string;
let employeeAId: string;
let employeeBId: string;
const createdUserIds: string[] = [];
const createdPageIds: string[] = [];

const JAN = parseMonthKey("2026-01")!;
const FEB = parseMonthKey("2026-02")!;

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (ads-transfer-flow)",
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;
  createdUserIds.push(admin.id);

  const employeeA = await createEmployee(
    { name: "Ads Transfer Employee A", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeAId = employeeA.employeeId;
  createdUserIds.push(employeeA.userId);

  const employeeB = await createEmployee(
    { name: "Ads Transfer Employee B", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeBId = employeeB.employeeId;
  createdUserIds.push(employeeB.userId);
});

afterAll(async () => {
  // AuditLog has no FK on entityId (free-form, spec §29) — deleting the
  // Page/AdExpense/Employee fixtures below wouldn't clean these up on its
  // own, and they'd otherwise sit in the shared dev DB as orphaned
  // TRANSFER/CREATE rows forever, polluting Admin Dashboard "Lịch sử thao tác".
  const adExpenses = await prisma.adExpense.findMany({ where: { pageId: { in: createdPageIds } }, select: { id: true } });
  await prisma.auditLog.deleteMany({
    where: { entityId: { in: [...createdPageIds, employeeAId, employeeBId, ...adExpenses.map((row) => row.id)] } },
  });
  await prisma.adExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pagePurchaseExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pageAssignment.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.page.deleteMany({ where: { id: { in: createdPageIds } } });
  await prisma.salaryHistory.deleteMany({ where: { employee: { userId: { in: createdUserIds } } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("AdExpense snapshot across Page transfer (spec §52 Integration Test Case 1, Ads monthly variant)", () => {
  it("keeps a month's AdExpense with whoever owned the Page on the 1st of that month — even if transferred mid-month", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-ads-mid-month-transfer",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-01"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    // Transfer to B mid-January — A still owned the Page on Jan 1st.
    await transferPage(created.pageId, { newEmployeeId: employeeBId, effectiveDate: new Date("2026-01-15") }, adminId);

    // January's AdExpense must snapshot A (owner at the start of the month), not B.
    const janExpense = await createAdExpense({ paidByAdminId: adminId, pageId: created.pageId, expenseMonth: JAN, amount: 2_000_000n }, adminId);
    const janRow = await prisma.adExpense.findUniqueOrThrow({ where: { id: janExpense.adExpenseId } });
    expect(janRow.employeeIdSnapshot).toBe(employeeAId);
    expect(janRow.amount).toBe(2_000_000n);

    // By February 1st, B is the owner — February's AdExpense snapshots B.
    const febExpense = await createAdExpense({ paidByAdminId: adminId, pageId: created.pageId, expenseMonth: FEB, amount: 3_000_000n }, adminId);
    const febRow = await prisma.adExpense.findUniqueOrThrow({ where: { id: febExpense.adExpenseId } });
    expect(febRow.employeeIdSnapshot).toBe(employeeBId);
    expect(febRow.amount).toBe(3_000_000n);

    // Totals stay split by snapshot, unaffected by the later transfer.
    const totalForA = await prisma.adExpense.aggregate({
      where: { employeeIdSnapshot: employeeAId, pageId: created.pageId },
      _sum: { amount: true },
    });
    expect(totalForA._sum.amount).toBe(2_000_000n);

    const totalForB = await prisma.adExpense.aggregate({
      where: { employeeIdSnapshot: employeeBId, pageId: created.pageId },
      _sum: { amount: true },
    });
    expect(totalForB._sum.amount).toBe(3_000_000n);
  });

  it("rejects creating AdExpense for a month before the Page had any assignment", async () => {
    const created = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-ads-before-assignment",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-03-01"),
        assignEmployeeId: employeeAId,
      },
      adminId,
    );
    createdPageIds.push(created.pageId);

    await expect(createAdExpense({ paidByAdminId: adminId, pageId: created.pageId, expenseMonth: JAN, amount: 1_000_000n }, adminId)).rejects.toThrow();

    const count = await prisma.adExpense.count({ where: { pageId: created.pageId } });
    expect(count).toBe(0);
  });
});
