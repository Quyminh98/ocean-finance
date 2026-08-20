import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee, EmployeeError } from "@/server/services/employee.service";
import { setEmployeeSalary } from "@/server/services/salary.service";

let adminId: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (salary-effective-date)",
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
  await prisma.salaryHistory.deleteMany({ where: { employee: { userId: { in: createdUserIds } } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

async function makeEmployee(monthlySalary: bigint, effectiveFrom: string) {
  const result = await createEmployee(
    { name: "Nguyễn Test", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  createdUserIds.push(result.userId);
  // createEmployee no longer seeds a SalaryHistory (spec §14.2) — set the
  // first one explicitly so these tests can still exercise `setEmployeeSalary`.
  await setEmployeeSalary(result.employeeId, { paidByAdminId: adminId, monthlySalary, effectiveFrom: new Date(effectiveFrom) }, adminId);
  return result;
}

describe("setEmployeeSalary", () => {
  it("closes the previously active record and keeps [effective_from, effective_to) intervals non-overlapping", async () => {
    const { employeeId } = await makeEmployee(10_000_000n, "2026-01-01");

    await setEmployeeSalary(employeeId, { paidByAdminId: adminId, monthlySalary: 12_000_000n, effectiveFrom: new Date("2026-07-01") }, adminId);

    const history = await prisma.salaryHistory.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: "asc" },
    });

    expect(history).toHaveLength(2);
    expect(history[0].monthlySalary).toBe(10_000_000n);
    expect(history[0].effectiveTo?.toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(history[1].monthlySalary).toBe(12_000_000n);
    expect(history[1].effectiveTo).toBeNull();
  });

  it("rejects a new effective date strictly before the current active record's", async () => {
    const { employeeId } = await makeEmployee(10_000_000n, "2026-01-01");

    await expect(
      setEmployeeSalary(employeeId, { paidByAdminId: adminId, monthlySalary: 11_000_000n, effectiveFrom: new Date("2025-12-01") }, adminId),
    ).rejects.toThrow(EmployeeError);

    const history = await prisma.salaryHistory.findMany({ where: { employeeId } });
    expect(history).toHaveLength(1);
    expect(history[0].monthlySalary).toBe(10_000_000n);
  });

  it("a same-day re-edit (effectiveFrom equal to the current active record's) overwrites it in place, no new row (user-reported bug 2026-08-18 — the date picker was removed, so a 2nd edit the same day is now normal, not an error)", async () => {
    const { employeeId } = await makeEmployee(10_000_000n, "2026-01-01");

    const updated = await setEmployeeSalary(
      employeeId,
      { paidByAdminId: adminId, monthlySalary: 15_000_000n, effectiveFrom: new Date("2026-01-01") },
      adminId,
    );

    const history = await prisma.salaryHistory.findMany({ where: { employeeId } });
    expect(history).toHaveLength(1); // still exactly 1 row — overwritten, not a new one appended
    expect(history[0].id).toBe(updated.id);
    expect(history[0].monthlySalary).toBe(15_000_000n);
    expect(history[0].effectiveTo).toBeNull();
  });

  it("never allows two active (effective_to IS NULL) rows for the same employee, enforced at the DB level", async () => {
    const { employeeId } = await makeEmployee(10_000_000n, "2026-01-01");

    await expect(
      prisma.salaryHistory.create({
        data: {
          employeeId,
          monthlySalary: 5_000_000n,
          effectiveFrom: new Date("2026-02-01"),
          createdByAdminId: adminId,
          paidByAdminId: adminId,
        },
      }),
    ).rejects.toThrow();
  });
});
