import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee, updateEmployee, deactivateEmployee, EmployeeError } from "@/server/services/employee.service";

let adminId: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (employee-service)",
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

describe("createEmployee", () => {
  it("creates User(role=USER) + EmployeeProfile atomically with no SalaryHistory yet (spec §14.2), plus an audit entry", async () => {
    const email = `test-employee-${randomUUID()}@example.test`;
    const result = await createEmployee({ name: "Trần Test", email, status: "ACTIVE" }, adminId);
    createdUserIds.push(result.userId);

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      include: { employeeProfile: { include: { salaryHistories: true } } },
    });
    expect(user?.role).toBe("USER");
    expect(user?.employeeProfile?.salaryHistories).toHaveLength(0);
    expect(result.tempPassword.length).toBeGreaterThan(0);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Employee", entityId: result.employeeId, action: "CREATE" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects a duplicate email, case-insensitively, without creating a partial record", async () => {
    const email = `test-employee-${randomUUID()}@example.test`;
    const first = await createEmployee({ name: "A", email, status: "ACTIVE" }, adminId);
    createdUserIds.push(first.userId);

    await expect(
      createEmployee({ name: "B", email: email.toUpperCase(), status: "ACTIVE" }, adminId),
    ).rejects.toThrow(EmployeeError);

    const userCount = await prisma.user.count({ where: { email: email.toLowerCase() } });
    expect(userCount).toBe(1);
  });
});

describe("deactivateEmployee", () => {
  it("sets status=INACTIVE without touching salary history, and is idempotent", async () => {
    const email = `test-employee-${randomUUID()}@example.test`;
    const created = await createEmployee({ name: "C", email, status: "ACTIVE" }, adminId);
    createdUserIds.push(created.userId);

    await deactivateEmployee(created.employeeId, adminId);
    const user = await prisma.user.findUnique({ where: { id: created.userId } });
    expect(user?.status).toBe("INACTIVE");

    await deactivateEmployee(created.employeeId, adminId);
    const auditCount = await prisma.auditLog.count({
      where: { entityType: "Employee", entityId: created.employeeId, action: "DEACTIVATE" },
    });
    expect(auditCount).toBe(1);

    const salaryHistory = await prisma.salaryHistory.findMany({ where: { employeeId: created.employeeId } });
    expect(salaryHistory).toHaveLength(0);
  });
});

describe("updateEmployee", () => {
  it("updates name/email/status, and rejects switching to an email already in use", async () => {
    const emailA = `test-employee-${randomUUID()}@example.test`;
    const emailB = `test-employee-${randomUUID()}@example.test`;
    const empA = await createEmployee({ name: "A", email: emailA, status: "ACTIVE" }, adminId);
    const empB = await createEmployee({ name: "B", email: emailB, status: "ACTIVE" }, adminId);
    createdUserIds.push(empA.userId, empB.userId);

    await updateEmployee(empA.employeeId, { name: "A2", email: emailA, status: "ACTIVE" }, adminId);
    const userA = await prisma.user.findUnique({ where: { id: empA.userId } });
    expect(userA?.name).toBe("A2");

    await expect(
      updateEmployee(empA.employeeId, { name: "A2", email: emailB, status: "ACTIVE" }, adminId),
    ).rejects.toThrow(EmployeeError);
  });
});
