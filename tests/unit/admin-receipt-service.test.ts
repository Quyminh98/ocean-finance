import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createEmployee } from "@/server/services/employee.service";
import { createPage } from "@/server/services/page.service";
import { createRevenue } from "@/server/services/revenue.service";
import {
  createAdminReceipt,
  updateAdminReceipt,
  softDeleteAdminReceipt,
  listAdminReceipts,
  AdminReceiptError,
} from "@/server/services/receipt.service";

let adminId: string;
const createdUserIds: string[] = [];
const createdReceiptIds: string[] = [];
const createdPageIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (admin-receipt-service)",
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
  await prisma.auditLog.deleteMany({ where: { entityType: "AdminReceipt", entityId: { in: createdReceiptIds } } });
  await prisma.adminReceipt.deleteMany({ where: { id: { in: createdReceiptIds } } });
  await prisma.revenue.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pagePurchaseExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pageAssignment.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.page.deleteMany({ where: { id: { in: createdPageIds } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("createAdminReceipt", () => {
  it("creates a record and writes an audit CREATE entry (spec §9)", async () => {
    const result = await createAdminReceipt(
      { receiptMonth: new Date("2026-03-01"), amount: 2_000_000n, source: "Chuyển khoản đối tác A", receivedByAdminId: adminId },
      adminId,
    );
    createdReceiptIds.push(result.adminReceiptId);

    const row = await prisma.adminReceipt.findUnique({ where: { id: result.adminReceiptId } });
    expect(row?.amount).toBe(2_000_000n);
    expect(row?.createdByAdminId).toBe(adminId);
    expect(row?.deletedAt).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "AdminReceipt", entityId: result.adminReceiptId, action: "CREATE" },
    });
    expect(audit).not.toBeNull();
  });
});

describe("updateAdminReceipt", () => {
  it("updates fields and writes before/after audit UPDATE", async () => {
    const created = await createAdminReceipt(
      { receiptMonth: new Date("2026-04-01"), amount: 1_000_000n, source: "Original", receivedByAdminId: adminId },
      adminId,
    );
    createdReceiptIds.push(created.adminReceiptId);

    await updateAdminReceipt(
      created.adminReceiptId,
      { receiptMonth: new Date("2026-04-01"), amount: 3_000_000n, source: "Updated", note: "note", receivedByAdminId: adminId },
      adminId,
    );

    const row = await prisma.adminReceipt.findUnique({ where: { id: created.adminReceiptId } });
    expect(row?.amount).toBe(3_000_000n);
    expect(row?.source).toBe("Updated");
    expect(row?.note).toBe("note");

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "AdminReceipt", entityId: created.adminReceiptId, action: "UPDATE" },
    });
    expect((audit?.beforeJson as { amount: string })?.amount).toBe("1000000");
    expect((audit?.afterJson as { amount: string })?.amount).toBe("3000000");
  });

  it("rejects updating a soft-deleted record", async () => {
    const created = await createAdminReceipt(
      { receiptMonth: new Date("2026-04-01"), amount: 500_000n, source: "To delete", receivedByAdminId: adminId },
      adminId,
    );
    createdReceiptIds.push(created.adminReceiptId);
    await softDeleteAdminReceipt(created.adminReceiptId, adminId);

    await expect(
      updateAdminReceipt(created.adminReceiptId, { receiptMonth: new Date("2026-04-01"), amount: 999n, source: "x", receivedByAdminId: adminId }, adminId),
    ).rejects.toThrow(AdminReceiptError);
  });
});

describe("softDeleteAdminReceipt", () => {
  it("hides a deleted record from the default list but keeps it in DB, and writes audit DELETE", async () => {
    const created = await createAdminReceipt(
      { receiptMonth: new Date("2026-05-01"), amount: 4_000_000n, source: "Soft-deletable", receivedByAdminId: adminId },
      adminId,
    );
    createdReceiptIds.push(created.adminReceiptId);

    const activeBefore = await listAdminReceipts({ createdByAdminId: adminId, page: 1, pageSize: 100 });
    expect(activeBefore.items.some((i) => i.adminReceiptId === created.adminReceiptId)).toBe(true);

    await softDeleteAdminReceipt(created.adminReceiptId, adminId);

    const activeAfter = await listAdminReceipts({ createdByAdminId: adminId, page: 1, pageSize: 100 });
    expect(activeAfter.items.some((i) => i.adminReceiptId === created.adminReceiptId)).toBe(false);

    const row = await prisma.adminReceipt.findUnique({ where: { id: created.adminReceiptId } });
    expect(row?.deletedAt).not.toBeNull();

    const deleteAudit = await prisma.auditLog.findFirst({
      where: { entityType: "AdminReceipt", entityId: created.adminReceiptId, action: "DELETE" },
    });
    expect(deleteAudit).not.toBeNull();
  });

  it("rejects deleting an already-deleted record", async () => {
    const created = await createAdminReceipt(
      { receiptMonth: new Date("2026-05-01"), amount: 100_000n, source: "Double delete", receivedByAdminId: adminId },
      adminId,
    );
    createdReceiptIds.push(created.adminReceiptId);
    await softDeleteAdminReceipt(created.adminReceiptId, adminId);

    await expect(softDeleteAdminReceipt(created.adminReceiptId, adminId)).rejects.toThrow(AdminReceiptError);
  });
});

describe("listAdminReceipts filters", () => {
  it("filters by month and by createdByAdminId (spec §13)", async () => {
    const otherAdmin = await prisma.user.create({
      data: {
        name: "Other Test Admin (admin-receipt-service)",
        email: `test-admin-${randomUUID()}@example.test`,
        passwordHash: "x",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    createdUserIds.push(otherAdmin.id);

    const juneByFirstAdmin = await createAdminReceipt(
      { receiptMonth: new Date("2026-06-01"), amount: 111n, source: "June, admin 1", receivedByAdminId: adminId },
      adminId,
    );
    createdReceiptIds.push(juneByFirstAdmin.adminReceiptId);

    const julyByFirstAdmin = await createAdminReceipt(
      { receiptMonth: new Date("2026-07-01"), amount: 222n, source: "July, admin 1", receivedByAdminId: adminId },
      adminId,
    );
    createdReceiptIds.push(julyByFirstAdmin.adminReceiptId);

    const juneByOtherAdmin = await createAdminReceipt(
      { receiptMonth: new Date("2026-06-01"), amount: 333n, source: "June, admin 2", receivedByAdminId: adminId },
      otherAdmin.id,
    );
    createdReceiptIds.push(juneByOtherAdmin.adminReceiptId);

    const juneOnly = await listAdminReceipts({ month: "2026-06", page: 1, pageSize: 100 });
    const juneIds = juneOnly.items.map((i) => i.adminReceiptId);
    expect(juneIds).toContain(juneByFirstAdmin.adminReceiptId);
    expect(juneIds).toContain(juneByOtherAdmin.adminReceiptId);
    expect(juneIds).not.toContain(julyByFirstAdmin.adminReceiptId);

    const byOtherAdmin = await listAdminReceipts({ createdByAdminId: otherAdmin.id, page: 1, pageSize: 100 });
    const otherAdminIds = byOtherAdmin.items.map((i) => i.adminReceiptId);
    expect(otherAdminIds).toEqual([juneByOtherAdmin.adminReceiptId]);
  });
});

describe("Total Received vs Total Page Revenue separation (spec §9, §10.4, §60)", () => {
  it("keeps the two sums independent for the same month, on purpose-built different amounts", async () => {
    const employee = await createEmployee(
      { name: "Receipt Isolation Employee", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
      adminId,
    );
    createdUserIds.push(employee.userId);

    const page = await createPage(
      {
        name: `Test Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/test-receipt-isolation",
        purchasePrice: 0n,
        purchaseMonth: new Date("2026-08-01"),
        assignEmployeeId: employee.employeeId,
      },
      adminId,
    );
    createdPageIds.push(page.pageId);

    await createRevenue({ pageId: page.pageId, revenueMonth: new Date("2026-08-01"), amount: 300_000_000n }, adminId);

    const receipt = await createAdminReceipt(
      { receiptMonth: new Date("2026-08-01"), amount: 250_000_000n, source: "Rút về ví Admin", receivedByAdminId: adminId },
      adminId,
    );
    createdReceiptIds.push(receipt.adminReceiptId);

    const [revenueSum, receiptSum] = await Promise.all([
      prisma.revenue.aggregate({
        where: { pageId: page.pageId, revenueMonth: new Date("2026-08-01") },
        _sum: { amount: true },
      }),
      prisma.adminReceipt.aggregate({
        where: {
          createdByAdminId: adminId,
          deletedAt: null,
          receiptMonth: new Date("2026-08-01"),
        },
        _sum: { amount: true },
      }),
    ]);

    expect(revenueSum._sum.amount).toBe(300_000_000n);
    expect(receiptSum._sum.amount).toBe(250_000_000n);
    expect(revenueSum._sum.amount).not.toBe(receiptSum._sum.amount);
  });
});
