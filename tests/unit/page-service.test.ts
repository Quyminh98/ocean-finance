import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee } from "@/server/services/employee.service";
import { transferPage } from "@/server/services/assignment.service";
import {
  createPage,
  createSystemPageForSelf,
  updatePage,
  updatePageStatusByEmployee,
  softDeletePage,
  listPages,
  listPagesByEmployee,
  PageError,
} from "@/server/services/page.service";

let adminId: string;
let employeeActiveId: string;
let employeeInactiveId: string;
let statusOptionAId: string;
let statusOptionBId: string;
const createdUserIds: string[] = [];
const createdPageIds: string[] = [];
const createdStatusOptionIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (page-service)",
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;
  createdUserIds.push(admin.id);

  const employeeActive = await createEmployee(
    {
      name: "Employee Active",
      email: `test-employee-${randomUUID()}@example.test`,
      status: "ACTIVE",
    },
    adminId,
  );
  employeeActiveId = employeeActive.employeeId;
  createdUserIds.push(employeeActive.userId);

  const employeeInactive = await createEmployee(
    {
      name: "Employee Inactive",
      email: `test-employee-${randomUUID()}@example.test`,
      status: "INACTIVE",
    },
    adminId,
  );
  employeeInactiveId = employeeInactive.employeeId;
  createdUserIds.push(employeeInactive.userId);

  const statusOptionA = await prisma.pageStatusOption.create({ data: { label: "Test Status A", color: "GREEN" } });
  statusOptionAId = statusOptionA.id;
  createdStatusOptionIds.push(statusOptionA.id);

  const statusOptionB = await prisma.pageStatusOption.create({ data: { label: "Test Status B", color: "GRAY" } });
  statusOptionBId = statusOptionB.id;
  createdStatusOptionIds.push(statusOptionB.id);
});

afterAll(async () => {
  await prisma.pagePurchaseExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pageAssignment.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.page.deleteMany({ where: { id: { in: createdPageIds } } });
  await prisma.pageStatusOption.deleteMany({ where: { id: { in: createdStatusOptionIds } } });
  await prisma.salaryHistory.deleteMany({ where: { employee: { userId: { in: createdUserIds } } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("createPage", () => {
  it("creates Page + first PageAssignment + PagePurchaseExpense snapshot in one transaction, plus an audit entry (spec §15.2/§44)", async () => {
    const result = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-page",
        purchasePrice: 5_000_000n,
        purchaseMonth: new Date("2026-01-05"),
        assignEmployeeId: employeeActiveId,
        paidByAdminId: adminId,
        statusIds: [statusOptionAId],
      },
      adminId,
    );
    createdPageIds.push(result.pageId);

    const assignment = await prisma.pageAssignment.findFirst({ where: { pageId: result.pageId } });
    expect(assignment?.employeeId).toBe(employeeActiveId);
    expect(assignment?.endedAt).toBeNull();

    const purchaseExpense = await prisma.pagePurchaseExpense.findUnique({ where: { pageId: result.pageId } });
    expect(purchaseExpense?.amount).toBe(5_000_000n);
    expect(purchaseExpense?.employeeIdSnapshot).toBe(employeeActiveId);
    expect(purchaseExpense?.assignmentIdSnapshot).toBe(assignment?.id);
    expect(purchaseExpense?.paidByAdminId).toBe(adminId);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Page", entityId: result.pageId, action: "CREATE" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects creating a Page with purchasePrice > 0 and an assigned employee, but no paidByAdminId", async () => {
    await expect(
      createPage(
        {
          name: `Test Page ${randomUUID()}`,
          facebookUrl: "https://facebook.com/test-page-missing-payer",
          purchasePrice: 2_000_000n,
          purchaseMonth: new Date("2026-01-05"),
          assignEmployeeId: employeeActiveId,
          statusIds: [statusOptionAId],
        },
        adminId,
      ),
    ).rejects.toThrow(PageError);

    const orphanCount = await prisma.page.count({ where: { facebookUrl: { contains: "test-page-missing-payer" } } });
    expect(orphanCount).toBe(0);
  });

  it("does not create a PagePurchaseExpense when purchasePrice = 0", async () => {
    const result = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-page-free",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        assignEmployeeId: employeeActiveId,
        statusIds: [statusOptionAId],
      },
      adminId,
    );
    createdPageIds.push(result.pageId);

    const purchaseExpense = await prisma.pagePurchaseExpense.findUnique({ where: { pageId: result.pageId } });
    expect(purchaseExpense).toBeNull();
  });

  it("rejects assigning a Page to an INACTIVE employee, without creating a partial record", async () => {
    await expect(
      createPage(
        {
          name: `Test Page ${randomUUID()}`,
          facebookUrl: "https://facebook.com/test-page-rejected",
          purchasePrice: 1_000_000n,
          purchaseMonth: new Date("2026-01-05"),
          assignEmployeeId: employeeInactiveId,
          statusIds: [statusOptionAId],
        },
        adminId,
      ),
    ).rejects.toThrow(PageError);

    const orphanCount = await prisma.page.count({ where: { facebookUrl: { contains: "test-page-rejected" } } });
    expect(orphanCount).toBe(0);
  });

  it("rejects pageType=SYSTEM with purchasePrice > 0 (Page hệ thống không có giá mua)", async () => {
    await expect(
      createPage(
        {
          name: `Test Page ${randomUUID()}`,
          facebookUrl: "https://facebook.com/test-page-system-priced",
          pageType: "SYSTEM",
          purchasePrice: 1_000_000n,
          purchaseMonth: new Date("2026-01-05"),
          statusIds: [statusOptionAId],
        },
        adminId,
      ),
    ).rejects.toThrow(PageError);

    const orphanCount = await prisma.page.count({ where: { facebookUrl: { contains: "test-page-system-priced" } } });
    expect(orphanCount).toBe(0);
  });

  it("defaults pageType to BKT when omitted (existing callers/tests predate this field)", async () => {
    const result = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-page-default-type",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        statusIds: [statusOptionAId],
      },
      adminId,
    );
    createdPageIds.push(result.pageId);

    const page = await prisma.page.findUnique({ where: { id: result.pageId } });
    expect(page?.pageType).toBe("BKT");
  });
});

describe("createSystemPageForSelf (user request 2026-08-18: \"user tự thêm page hệ thống vào account do mình quản lý\")", () => {
  it("creates a SYSTEM Page with purchasePrice=0, auto-assigns the caller, and writes no PagePurchaseExpense", async () => {
    const result = await createSystemPageForSelf(
      { name: `Test Self Page ${randomUUID()}`, facebookUrl: "https://facebook.com/test-self-page", statusIds: [statusOptionAId] },
      employeeActiveId,
      adminId, // reuse the admin fixture as "the acting User" — createdByAdminId/assignedByAdminId are plain FK→User, not role-restricted
    );
    createdPageIds.push(result.pageId);

    const page = await prisma.page.findUnique({ where: { id: result.pageId } });
    expect(page?.pageType).toBe("SYSTEM");
    expect(page?.purchasePrice).toBe(0n);
    expect(page?.paidByAdminId).toBeNull();

    const assignment = await prisma.pageAssignment.findFirst({ where: { pageId: result.pageId } });
    expect(assignment?.employeeId).toBe(employeeActiveId);
    expect(assignment?.endedAt).toBeNull();

    const purchaseExpense = await prisma.pagePurchaseExpense.findUnique({ where: { pageId: result.pageId } });
    expect(purchaseExpense).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Page", entityId: result.pageId, action: "CREATE" },
    });
    expect(audit).not.toBeNull();
  });
});

describe("updatePage", () => {
  it("updates name/URL/status/notes only — never touches the current employee", async () => {
    const result = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-page-edit",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        assignEmployeeId: employeeActiveId,
        statusIds: [statusOptionAId],
      },
      adminId,
    );
    createdPageIds.push(result.pageId);

    await updatePage(
      result.pageId,
      { name: "Renamed Page", facebookUrl: "https://facebook.com/renamed", statusIds: [statusOptionBId], notes: "archived for test" },
      adminId,
    );

    const page = await prisma.page.findUnique({ where: { id: result.pageId } });
    expect(page?.name).toBe("Renamed Page");
    const statusAssignments = await prisma.pageStatusAssignment.findMany({ where: { pageId: result.pageId } });
    expect(statusAssignments.map((a) => a.statusOptionId)).toEqual([statusOptionBId]);
    expect(page?.notes).toBe("archived for test");

    const assignment = await prisma.pageAssignment.findFirst({ where: { pageId: result.pageId } });
    expect(assignment?.employeeId).toBe(employeeActiveId);
  });

  it("allows assigning multiple statuses at once (user request 2026-08-18)", async () => {
    const result = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-page-multi-status",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        statusIds: [statusOptionAId, statusOptionBId],
      },
      adminId,
    );
    createdPageIds.push(result.pageId);

    const assignmentsAfterCreate = await prisma.pageStatusAssignment.findMany({ where: { pageId: result.pageId } });
    expect(new Set(assignmentsAfterCreate.map((a) => a.statusOptionId))).toEqual(new Set([statusOptionAId, statusOptionBId]));

    await updatePage(
      result.pageId,
      { name: "Multi Status Page", facebookUrl: "https://facebook.com/test-page-multi-status", statusIds: [statusOptionAId] },
      adminId,
    );
    const assignmentsAfterUpdate = await prisma.pageStatusAssignment.findMany({ where: { pageId: result.pageId } });
    expect(assignmentsAfterUpdate.map((a) => a.statusOptionId)).toEqual([statusOptionAId]);
  });

  it("dropping a Page down to zero statuses is allowed (\"chưa đặt\")", async () => {
    const result = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-page-clear-status",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        statusIds: [statusOptionAId],
      },
      adminId,
    );
    createdPageIds.push(result.pageId);

    await updatePage(
      result.pageId,
      { name: "Cleared Status Page", facebookUrl: "https://facebook.com/test-page-clear-status", statusIds: [] },
      adminId,
    );
    const assignments = await prisma.pageStatusAssignment.findMany({ where: { pageId: result.pageId } });
    expect(assignments).toHaveLength(0);
  });
});

describe("PageStatusOption deletion cascades to PageStatusAssignment", () => {
  it("deleting an option only removes that one assignment — other statuses on the same Page survive", async () => {
    const extraOption = await prisma.pageStatusOption.create({ data: { label: "Test Status Extra", color: "BLUE" } });
    // Tracked here too (not just the explicit delete below) so a failure anywhere between create and
    // delete can't orphan this row past the run — afterAll's deleteMany is a no-op on an already-deleted id.
    createdStatusOptionIds.push(extraOption.id);

    const result = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-page-cascade",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        statusIds: [statusOptionAId, extraOption.id],
      },
      adminId,
    );
    createdPageIds.push(result.pageId);

    await prisma.pageStatusOption.delete({ where: { id: extraOption.id } });

    const remaining = await prisma.pageStatusAssignment.findMany({ where: { pageId: result.pageId } });
    expect(remaining.map((a) => a.statusOptionId)).toEqual([statusOptionAId]);
  });
});

describe("softDeletePage", () => {
  it("sets deletedAt, hides the Page from listPages, and leaves its PageAssignment/PagePurchaseExpense untouched", async () => {
    const result = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-page-delete",
        purchasePrice: 1_000_000n,
        purchaseMonth: new Date("2026-01-05"),
        assignEmployeeId: employeeActiveId,
        paidByAdminId: adminId,
        statusIds: [statusOptionAId],
      },
      adminId,
    );
    createdPageIds.push(result.pageId);

    await softDeletePage(result.pageId, adminId);

    const page = await prisma.page.findUnique({ where: { id: result.pageId } });
    expect(page?.deletedAt).not.toBeNull();

    const listed = await listPages({});
    expect(listed.items.map((item) => item.pageId)).not.toContain(result.pageId);

    const assignment = await prisma.pageAssignment.findFirst({ where: { pageId: result.pageId } });
    expect(assignment?.employeeId).toBe(employeeActiveId);
    const purchaseExpense = await prisma.pagePurchaseExpense.findUnique({ where: { pageId: result.pageId } });
    expect(purchaseExpense?.amount).toBe(1_000_000n);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Page", entityId: result.pageId, action: "DELETE" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects deleting an already-deleted (or non-existent) Page", async () => {
    const result = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-page-delete-twice",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        statusIds: [statusOptionAId],
      },
      adminId,
    );
    createdPageIds.push(result.pageId);

    await softDeletePage(result.pageId, adminId);
    await expect(softDeletePage(result.pageId, adminId)).rejects.toThrow(PageError);
    await expect(softDeletePage(randomUUID(), adminId)).rejects.toThrow(PageError);
  });
});

describe("listPages filters (user request 2026-08-18: \"filter theo tên page, loại, trạng thái và nhân viên phụ trách\")", () => {
  it("filters by pageType, statusId, and employeeId independently", async () => {
    const employeeActive2 = await createEmployee(
      { name: "Employee Active 2 (page filters)", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
      adminId,
    );
    createdUserIds.push(employeeActive2.userId);

    const systemPage = await createSystemPageForSelf(
      { name: `Test Filter System ${randomUUID()}`, facebookUrl: "https://facebook.com/test-filter-system", statusIds: [statusOptionAId] },
      employeeActiveId,
      adminId,
    );
    createdPageIds.push(systemPage.pageId);

    const bktPage = await createPage(
      {
        name: `Test Filter BKT ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-filter-bkt",
        pageType: "BKT",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        assignEmployeeId: employeeActive2.employeeId,
        statusIds: [statusOptionBId],
      },
      adminId,
    );
    createdPageIds.push(bktPage.pageId);

    const byType = await listPages({ pageType: "SYSTEM" });
    expect(byType.items.map((item) => item.pageId)).toContain(systemPage.pageId);
    expect(byType.items.map((item) => item.pageId)).not.toContain(bktPage.pageId);

    const byStatus = await listPages({ statusId: statusOptionBId });
    expect(byStatus.items.map((item) => item.pageId)).toContain(bktPage.pageId);
    expect(byStatus.items.map((item) => item.pageId)).not.toContain(systemPage.pageId);

    const byEmployee = await listPages({ employeeId: employeeActiveId });
    expect(byEmployee.items.map((item) => item.pageId)).toContain(systemPage.pageId);
    expect(byEmployee.items.map((item) => item.pageId)).not.toContain(bktPage.pageId);

    const combined = await listPages({ pageType: "SYSTEM", employeeId: employeeActive2.employeeId });
    expect(combined.items.map((item) => item.pageId)).not.toContain(systemPage.pageId);
    expect(combined.items.map((item) => item.pageId)).not.toContain(bktPage.pageId);
  });
});

describe("listPagesByEmployee (user request 2026-08-18: \"/user/pages\" mirrors the admin table, scoped to one employee)", () => {
  it("only returns Pages the employee CURRENTLY manages, with the same fields as listPages", async () => {
    const result = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-page-by-employee",
        purchasePrice: 2_000_000n,
        purchaseMonth: new Date("2026-01-05"),
        assignEmployeeId: employeeActiveId,
        paidByAdminId: adminId,
        statusIds: [statusOptionAId],
      },
      adminId,
    );
    createdPageIds.push(result.pageId);

    const rows = await listPagesByEmployee(employeeActiveId);
    const row = rows.find((r) => r.pageId === result.pageId);
    expect(row).toBeDefined();
    expect(row?.purchasePrice).toBe(2_000_000n);
    expect(row?.currentStatuses.map((s) => s.statusId)).toEqual([statusOptionAId]);

    const otherEmployeeRows = await listPagesByEmployee(employeeInactiveId);
    expect(otherEmployeeRows.some((r) => r.pageId === result.pageId)).toBe(false);
  });

  it("drops a Page from the list once transferred to another employee (no history — confirmed with user)", async () => {
    const employee2 = await createEmployee(
      { name: "Page Service Transfer Target", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
      adminId,
    );
    createdUserIds.push(employee2.userId);

    const result = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-page-transfer-scope",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        assignEmployeeId: employeeActiveId,
        statusIds: [statusOptionAId],
      },
      adminId,
    );
    createdPageIds.push(result.pageId);

    await transferPage(result.pageId, { newEmployeeId: employee2.employeeId, effectiveDate: new Date("2026-02-01") }, adminId);

    const oldOwnerRows = await listPagesByEmployee(employeeActiveId);
    expect(oldOwnerRows.some((r) => r.pageId === result.pageId)).toBe(false);

    const newOwnerRows = await listPagesByEmployee(employee2.employeeId);
    expect(newOwnerRows.some((r) => r.pageId === result.pageId)).toBe(true);
  });

  it("filters by search, pageType, and statusId (user request 2026-08-18: \"cũng có filter như thế\" on /user/pages)", async () => {
    const systemPage = await createSystemPageForSelf(
      { name: `Test Employee Filter System ${randomUUID()}`, facebookUrl: "https://facebook.com/test-employee-filter-system", statusIds: [statusOptionAId] },
      employeeActiveId,
      adminId,
    );
    createdPageIds.push(systemPage.pageId);

    const bktPage = await createPage(
      {
        name: `Test Employee Filter BKT ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-employee-filter-bkt",
        pageType: "BKT",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        assignEmployeeId: employeeActiveId,
        statusIds: [statusOptionBId],
      },
      adminId,
    );
    createdPageIds.push(bktPage.pageId);

    const bySearch = await listPagesByEmployee(employeeActiveId, { search: "Test Employee Filter System" });
    expect(bySearch.map((r) => r.pageId)).toContain(systemPage.pageId);
    expect(bySearch.map((r) => r.pageId)).not.toContain(bktPage.pageId);

    const byType = await listPagesByEmployee(employeeActiveId, { pageType: "BKT" });
    expect(byType.map((r) => r.pageId)).toContain(bktPage.pageId);
    expect(byType.map((r) => r.pageId)).not.toContain(systemPage.pageId);

    const byStatus = await listPagesByEmployee(employeeActiveId, { statusId: statusOptionAId });
    expect(byStatus.map((r) => r.pageId)).toContain(systemPage.pageId);
    expect(byStatus.map((r) => r.pageId)).not.toContain(bktPage.pageId);
  });
});

describe("updatePageStatusByEmployee (user request 2026-08-18: \"chỉ có thể edit được trạng thái thôi\")", () => {
  it("updates the status tags of a Page the employee currently manages, and writes an audit UPDATE entry", async () => {
    const result = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-page-status-by-employee",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        assignEmployeeId: employeeActiveId,
        statusIds: [statusOptionAId],
      },
      adminId,
    );
    createdPageIds.push(result.pageId);

    const employeeUser = await prisma.employeeProfile.findUniqueOrThrow({ where: { id: employeeActiveId } });
    await updatePageStatusByEmployee(result.pageId, employeeActiveId, { statusIds: [statusOptionBId] }, employeeUser.userId);

    const statusAssignments = await prisma.pageStatusAssignment.findMany({ where: { pageId: result.pageId } });
    expect(statusAssignments.map((a) => a.statusOptionId)).toEqual([statusOptionBId]);

    // Name/URL must stay untouched — only status is editable at this RBAC level.
    const page = await prisma.page.findUnique({ where: { id: result.pageId } });
    expect(page?.facebookUrl).toBe("https://facebook.com/test-page-status-by-employee");

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Page", entityId: result.pageId, action: "UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects when the employee does NOT currently manage this Page (RBAC boundary)", async () => {
    const result = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-page-status-forbidden",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-01-05"),
        assignEmployeeId: employeeActiveId,
        statusIds: [statusOptionAId],
      },
      adminId,
    );
    createdPageIds.push(result.pageId);

    const employeeUser = await prisma.employeeProfile.findUniqueOrThrow({ where: { id: employeeInactiveId } });
    await expect(
      updatePageStatusByEmployee(result.pageId, employeeInactiveId, { statusIds: [statusOptionBId] }, employeeUser.userId),
    ).rejects.toThrow(PageError);

    // Status must stay unchanged after the rejected attempt.
    const statusAssignments = await prisma.pageStatusAssignment.findMany({ where: { pageId: result.pageId } });
    expect(statusAssignments.map((a) => a.statusOptionId)).toEqual([statusOptionAId]);
  });
});
