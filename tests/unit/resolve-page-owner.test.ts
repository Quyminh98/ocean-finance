import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee } from "@/server/services/employee.service";
import { resolvePageOwner } from "@/server/services/assignment.service";
import { PageError } from "@/server/services/page.service";

let adminId: string;
let employeeAId: string;
let employeeBId: string;
const createdUserIds: string[] = [];
const createdPageIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (resolve-page-owner)",
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;
  createdUserIds.push(admin.id);

  const employeeA = await createEmployee(
    {
      name: "Employee A",
      email: `test-employee-${randomUUID()}@example.test`,
      status: "ACTIVE",
    },
    adminId,
  );
  employeeAId = employeeA.employeeId;
  createdUserIds.push(employeeA.userId);

  const employeeB = await createEmployee(
    {
      name: "Employee B",
      email: `test-employee-${randomUUID()}@example.test`,
      status: "ACTIVE",
    },
    adminId,
  );
  employeeBId = employeeB.employeeId;
  createdUserIds.push(employeeB.userId);
});

afterAll(async () => {
  await prisma.pageAssignment.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.page.deleteMany({ where: { id: { in: createdPageIds } } });
  await prisma.salaryHistory.deleteMany({ where: { employee: { userId: { in: createdUserIds } } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

async function createTestPage() {
  const page = await prisma.page.create({
    data: {
      name: `Test Page ${randomUUID()}`,
      facebookUrl: "https://facebook.com/test",
      purchasePrice: 0n,
      purchaseMonth: new Date("2026-01-01"),
      createdByAdminId: adminId,
    },
  });
  createdPageIds.push(page.id);
  return page;
}

describe("resolvePageOwner", () => {
  it("returns the employee whose assignment covers the given date (spec §36 step 1/4)", async () => {
    const page = await createTestPage();
    const assignment = await prisma.pageAssignment.create({
      data: { pageId: page.id, employeeId: employeeAId, startedAt: new Date("2026-01-01"), assignedByAdminId: adminId },
    });

    const result = await resolvePageOwner(page.id, new Date("2026-03-01"));
    expect(result.employeeId).toBe(employeeAId);
    expect(result.assignmentId).toBe(assignment.id);
  });

  it("resolves the historical owner even after the page has since been transferred", async () => {
    const page = await createTestPage();
    const first = await prisma.pageAssignment.create({
      data: {
        pageId: page.id,
        employeeId: employeeAId,
        startedAt: new Date("2026-01-01"),
        endedAt: new Date("2026-05-16"),
        assignedByAdminId: adminId,
      },
    });
    await prisma.pageAssignment.create({
      data: { pageId: page.id, employeeId: employeeBId, startedAt: new Date("2026-05-16"), assignedByAdminId: adminId },
    });

    const historical = await resolvePageOwner(page.id, new Date("2026-03-01"));
    expect(historical.employeeId).toBe(employeeAId);
    expect(historical.assignmentId).toBe(first.id);

    const current = await resolvePageOwner(page.id, new Date("2026-06-01"));
    expect(current.employeeId).toBe(employeeBId);
  });

  it("rejects — clearly — when the page has no valid assignment at that date (spec §36 step 2)", async () => {
    const page = await createTestPage();
    await prisma.pageAssignment.create({
      data: { pageId: page.id, employeeId: employeeAId, startedAt: new Date("2026-03-01"), assignedByAdminId: adminId },
    });

    await expect(resolvePageOwner(page.id, new Date("2026-01-01"))).rejects.toThrow(PageError);
    await resolvePageOwner(page.id, new Date("2026-01-01")).catch((error: PageError) => {
      expect(error.code).toBe("NO_ASSIGNMENT");
    });
  });

  it("throws a data-integrity error when more than one assignment is valid at the same date — simulated corrupted data (spec §36 step 3)", async () => {
    const page = await createTestPage();
    // Deliberately bypasses the service layer to simulate corrupted data: the
    // partial unique index only blocks two endedAt=NULL rows, not two rows
    // whose [started_at, ended_at) ranges simply overlap.
    await prisma.pageAssignment.create({
      data: {
        pageId: page.id,
        employeeId: employeeAId,
        startedAt: new Date("2026-01-01"),
        endedAt: new Date("2026-06-01"),
        assignedByAdminId: adminId,
      },
    });
    await prisma.pageAssignment.create({
      data: { pageId: page.id, employeeId: employeeBId, startedAt: new Date("2026-03-01"), assignedByAdminId: adminId },
    });

    await expect(resolvePageOwner(page.id, new Date("2026-04-01"))).rejects.toThrow(PageError);
    await resolvePageOwner(page.id, new Date("2026-04-01")).catch((error: PageError) => {
      expect(error.code).toBe("DATA_INTEGRITY_ERROR");
    });
  });

  it("rejects a second active (endedAt=NULL) assignment on the same page at the database level", async () => {
    const page = await createTestPage();
    await prisma.pageAssignment.create({
      data: { pageId: page.id, employeeId: employeeAId, startedAt: new Date("2026-01-01"), assignedByAdminId: adminId },
    });

    await expect(
      prisma.pageAssignment.create({
        data: { pageId: page.id, employeeId: employeeBId, startedAt: new Date("2026-02-01"), assignedByAdminId: adminId },
      }),
    ).rejects.toThrow();
  });
});
