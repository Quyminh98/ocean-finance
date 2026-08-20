import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee } from "@/server/services/employee.service";
import { createPage } from "@/server/services/page.service";
import { transferPage } from "@/server/services/assignment.service";
import { listAuditLogs, listAuditFilterOptions } from "@/server/services/audit.service";

let adminId: string;
let adminName: string;
let employeeAId: string;
let employeeBId: string;
let pageId: string;
const createdUserIds: string[] = [];
const createdPageIds: string[] = [];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: `Test Admin (audit-service) ${randomUUID()}`,
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;
  adminName = admin.name;
  createdUserIds.push(admin.id);

  const employeeA = await createEmployee(
    { name: "Audit Employee A", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeAId = employeeA.employeeId;
  createdUserIds.push(employeeA.userId);

  const employeeB = await createEmployee(
    { name: "Audit Employee B", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeBId = employeeB.employeeId;
  createdUserIds.push(employeeB.userId);

  const page = await createPage(
    {
      name: `Audit Test Page ${randomUUID()}`,
      facebookUrl: "https://facebook.com/audit-test-page",
      purchasePrice: 0n,
      purchaseMonth: new Date("2026-01-05"),
      assignEmployeeId: employeeAId,
    },
    adminId,
  );
  pageId = page.pageId;
  createdPageIds.push(pageId);

  // Business-date far in the past (relative to "today"); the AuditLog rows
  // this produces are still timestamped with the real wall-clock "now".
  await transferPage(pageId, { newEmployeeId: employeeBId, effectiveDate: new Date("2026-05-16") }, adminId);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { entityType: "Page", entityId: { in: createdPageIds } },
        { entityType: "Employee", entityId: { in: [employeeAId, employeeBId] } },
      ],
    },
  });
  await prisma.pagePurchaseExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pageAssignment.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.page.deleteMany({ where: { id: { in: createdPageIds } } });
  await prisma.salaryHistory.deleteMany({ where: { employee: { userId: { in: createdUserIds } } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("listAuditLogs", () => {
  it("filters by entityType + actorUserId and finds the CREATE + TRANSFER Page entries (spec §29)", async () => {
    const { items } = await listAuditLogs({ entityType: "Page", actorUserId: adminId, entityId: pageId });
    const actions = items.map((i) => i.action).sort();
    expect(actions).toEqual(["CREATE", "TRANSFER"]);
    for (const item of items) {
      expect(item.actorType).toBe("USER");
      expect(item.actorName).toBe(adminName);
      expect(item.entityId).toBe(pageId);
    }
  });

  it("TRANSFER before/after snapshots the old vs. new employee (spec §29 example format)", async () => {
    const { items } = await listAuditLogs({ entityId: pageId, action: "TRANSFER" });
    expect(items).toHaveLength(1);
    const [transfer] = items;
    expect((transfer.beforeJson as { employeeId: string }).employeeId).toBe(employeeAId);
    expect((transfer.afterJson as { employeeId: string }).employeeId).toBe(employeeBId);
  });

  it("filters by entityType=Employee and finds both CREATE entries", async () => {
    const { items } = await listAuditLogs({ entityType: "Employee", actorUserId: adminId });
    const entityIds = items.map((i) => i.entityId);
    expect(entityIds).toEqual(expect.arrayContaining([employeeAId, employeeBId]));
    expect(items.every((i) => i.action === "CREATE")).toBe(true);
  });

  it("entityId filter is an exact match — an unrelated UUID returns nothing", async () => {
    const { items } = await listAuditLogs({ entityId: randomUUID() });
    expect(items).toHaveLength(0);
  });

  it("date range excludes rows outside [dateFrom, dateTo] and includes rows inside it", async () => {
    const today = isoDay(Date.now());
    const tomorrow = isoDay(Date.now() + ONE_DAY_MS);
    const yesterday = isoDay(Date.now() - ONE_DAY_MS);

    const withinRange = await listAuditLogs({ entityId: pageId, dateFrom: today });
    expect(withinRange.items.length).toBeGreaterThanOrEqual(2);

    const beforeToday = await listAuditLogs({ entityId: pageId, dateTo: yesterday });
    expect(beforeToday.items).toHaveLength(0);

    const afterToday = await listAuditLogs({ entityId: pageId, dateFrom: tomorrow });
    expect(afterToday.items).toHaveLength(0);
  });

  it("sorts newest first (TRANSFER happened after CREATE)", async () => {
    const { items, total } = await listAuditLogs({ entityId: pageId, page: 1, pageSize: 20 });
    expect(total).toBe(2);
    expect(items.map((i) => i.action)).toEqual(["TRANSFER", "CREATE"]);
  });
});

describe("listAuditFilterOptions", () => {
  it("surfaces the entityType/action/actor values actually present in the log", async () => {
    const options = await listAuditFilterOptions();
    expect(options.entityTypes).toEqual(expect.arrayContaining(["Page", "Employee"]));
    expect(options.actions).toEqual(expect.arrayContaining(["CREATE", "TRANSFER"]));
    expect(options.actors).toEqual(expect.arrayContaining([{ id: adminId, name: adminName }]));
  });
});
