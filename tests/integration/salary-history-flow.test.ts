import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee, deactivateEmployee, listEmployees, EmployeeError } from "@/server/services/employee.service";
import { setEmployeeSalary, getSalaryHistory } from "@/server/services/salary.service";

let adminId: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (salary-history-flow)",
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

describe("Employee lifecycle: create -> set initial salary -> raise twice -> deactivate", () => {
  it("keeps salary history intact and the list reflects the current salary, even after deactivation (spec §55, §59)", async () => {
    const email = `test-employee-${randomUUID()}@example.test`;

    const created = await createEmployee({ name: "Integration Test", email, status: "ACTIVE" }, adminId);
    createdUserIds.push(created.userId);

    // No SalaryHistory yet (spec §14.2) — Admin sets the first one via "Đổi lương".
    const beforeAnySalary = await listEmployees({ search: email });
    expect(beforeAnySalary.items[0].currentSalary).toBe(0n);

    await setEmployeeSalary(created.employeeId, { paidByAdminId: adminId, monthlySalary: 10_000_000n, effectiveFrom: new Date("2026-01-01") }, adminId);
    await setEmployeeSalary(created.employeeId, { paidByAdminId: adminId, monthlySalary: 12_000_000n, effectiveFrom: new Date("2026-07-01") }, adminId);
    await setEmployeeSalary(created.employeeId, { paidByAdminId: adminId, monthlySalary: 15_000_000n, effectiveFrom: new Date("2026-09-01") }, adminId);

    const history = await getSalaryHistory(created.employeeId);
    expect(history).toHaveLength(3);
    expect(history[0].monthlySalary).toBe(15_000_000n);
    expect(history[0].effectiveTo).toBeNull();
    expect(history[0].paidByAdminId).toBe(adminId);
    expect(history[1].effectiveTo?.toISOString().slice(0, 10)).toBe("2026-09-01");
    expect(history[2].effectiveTo?.toISOString().slice(0, 10)).toBe("2026-07-01");

    const beforeDeactivate = await listEmployees({ search: email });
    expect(beforeDeactivate.items).toHaveLength(1);
    expect(beforeDeactivate.items[0].currentSalary).toBe(15_000_000n);
    expect(beforeDeactivate.items[0].status).toBe("ACTIVE");

    await deactivateEmployee(created.employeeId, adminId);

    const afterDeactivate = await listEmployees({ search: email });
    expect(afterDeactivate.items).toHaveLength(1);
    expect(afterDeactivate.items[0].status).toBe("INACTIVE");
    expect(afterDeactivate.items[0].currentSalary).toBe(15_000_000n);

    const historyAfterDeactivate = await getSalaryHistory(created.employeeId);
    expect(historyAfterDeactivate).toHaveLength(3);
  });

  it("rejects setting a salary with a paidByAdminId that isn't an Admin", async () => {
    const created = await createEmployee(
      { name: "Invalid Payer Test", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
      adminId,
    );
    createdUserIds.push(created.userId);

    await expect(
      setEmployeeSalary(
        created.employeeId,
        { paidByAdminId: created.userId, monthlySalary: 5_000_000n, effectiveFrom: new Date("2026-01-01") },
        adminId,
      ),
    ).rejects.toThrow(EmployeeError);

    const history = await getSalaryHistory(created.employeeId);
    expect(history).toHaveLength(0);
  });
});
