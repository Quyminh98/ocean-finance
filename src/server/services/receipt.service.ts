import { prisma } from "@/lib/db";
import { logAction, auditActorFields } from "@/server/audit/log-action";
import { parseMonthKey } from "@/lib/month";
import type { AuditMeta } from "@/server/services/employee.service";

// AdminReceipt (`Total Received`, spec §9/§10.4) is a separate figure from
// Page Revenue (`Revenue` model, spec §4) — this service never joins or sums
// against `prisma.revenue`. Keep the two aggregations independent everywhere
// they're read, including the future Admin Dashboard KPI cards (Phase 11).

export class AdminReceiptError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export const ADMIN_RECEIPT_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export type AdminReceiptPageSize = (typeof ADMIN_RECEIPT_PAGE_SIZE_OPTIONS)[number];

export type AdminReceiptListItem = {
  adminReceiptId: string;
  receiptMonth: Date;
  amount: bigint;
  source: string;
  note: string | null;
  createdByAdminId: string;
  createdByAdminName: string;
  receivedByAdminId: string;
  receivedByAdminName: string;
  deletedAt: Date | null;
};

export type AdminReceiptListResult = {
  items: AdminReceiptListItem[];
  total: number;
  page: number;
  pageSize: AdminReceiptPageSize;
};

export type ListAdminReceiptsParams = {
  month?: string;
  createdByAdminId?: string;
  page?: number;
  pageSize?: AdminReceiptPageSize;
};

export async function listAdminReceipts(params: ListAdminReceiptsParams): Promise<AdminReceiptListResult> {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const pageSize = params.pageSize && ADMIN_RECEIPT_PAGE_SIZE_OPTIONS.includes(params.pageSize) ? params.pageSize : 20;
  const monthFilter = params.month ? parseMonthKey(params.month) : null;

  const where = {
    deletedAt: null,
    ...(monthFilter ? { receiptMonth: monthFilter } : {}),
    ...(params.createdByAdminId ? { createdByAdminId: params.createdByAdminId } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.adminReceipt.count({ where }),
    prisma.adminReceipt.findMany({
      where,
      orderBy: { receiptMonth: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { createdByAdmin: { select: { name: true } }, receivedByAdmin: { select: { name: true } } },
    }),
  ]);

  const items: AdminReceiptListItem[] = rows.map((row) => ({
    adminReceiptId: row.id,
    receiptMonth: row.receiptMonth,
    amount: row.amount,
    source: row.source,
    note: row.note,
    createdByAdminId: row.createdByAdminId,
    createdByAdminName: row.createdByAdmin.name,
    receivedByAdminId: row.receivedByAdminId,
    receivedByAdminName: row.receivedByAdmin.name,
    deletedAt: row.deletedAt,
  }));

  return { items, total, page, pageSize };
}

export type CreateAdminReceiptInput = {
  receiptMonth: Date;
  amount: bigint;
  source: string;
  note?: string;
  receivedByAdminId: string;
};

export type CreateAdminReceiptResult = { adminReceiptId: string };

export async function createAdminReceipt(
  input: CreateAdminReceiptInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<CreateAdminReceiptResult> {
  const receiver = await prisma.user.findUnique({ where: { id: input.receivedByAdminId } });
  if (!receiver || receiver.role !== "ADMIN") throw new AdminReceiptError("Admin nhận không hợp lệ.", "INVALID_RECEIVER");

  const receipt = await prisma.adminReceipt.create({
    data: {
      receiptMonth: input.receiptMonth,
      amount: input.amount,
      source: input.source,
      note: input.note,
      createdByAdminId: adminId,
      receivedByAdminId: input.receivedByAdminId,
    },
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "CREATE",
    entityType: "AdminReceipt",
    entityId: receipt.id,
    afterJson: {
      receiptMonth: input.receiptMonth.toISOString().slice(0, 7),
      amount: input.amount.toString(),
      source: input.source,
      note: input.note ?? null,
      receivedByAdminId: input.receivedByAdminId,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { adminReceiptId: receipt.id };
}

export type UpdateAdminReceiptInput = CreateAdminReceiptInput;

export async function updateAdminReceipt(
  adminReceiptId: string,
  input: UpdateAdminReceiptInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<void> {
  const existing = await prisma.adminReceipt.findUnique({ where: { id: adminReceiptId } });
  if (!existing || existing.deletedAt) throw new AdminReceiptError("Không tìm thấy khoản nhận.", "NOT_FOUND");

  const receiver = await prisma.user.findUnique({ where: { id: input.receivedByAdminId } });
  if (!receiver || receiver.role !== "ADMIN") throw new AdminReceiptError("Admin nhận không hợp lệ.", "INVALID_RECEIVER");

  const before = {
    receiptMonth: existing.receiptMonth.toISOString().slice(0, 7),
    amount: existing.amount.toString(),
    source: existing.source,
    note: existing.note,
    receivedByAdminId: existing.receivedByAdminId,
  };

  await prisma.adminReceipt.update({
    where: { id: adminReceiptId },
    data: {
      receiptMonth: input.receiptMonth,
      amount: input.amount,
      source: input.source,
      note: input.note ?? null,
      receivedByAdminId: input.receivedByAdminId,
    },
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "UPDATE",
    entityType: "AdminReceipt",
    entityId: adminReceiptId,
    beforeJson: before,
    afterJson: {
      receiptMonth: input.receiptMonth.toISOString().slice(0, 7),
      amount: input.amount.toString(),
      source: input.source,
      note: input.note ?? null,
      receivedByAdminId: input.receivedByAdminId,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/** Soft delete — sets `deletedAt`, never removes the row (CLAUDE.md "Soft delete cho dữ liệu tài chính"). */
export async function softDeleteAdminReceipt(adminReceiptId: string, adminId: string, meta: AuditMeta = {}): Promise<void> {
  const existing = await prisma.adminReceipt.findUnique({ where: { id: adminReceiptId } });
  if (!existing || existing.deletedAt) throw new AdminReceiptError("Không tìm thấy khoản nhận.", "NOT_FOUND");

  await prisma.adminReceipt.update({ where: { id: adminReceiptId }, data: { deletedAt: new Date() } });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "DELETE",
    entityType: "AdminReceipt",
    entityId: adminReceiptId,
    beforeJson: {
      receiptMonth: existing.receiptMonth.toISOString().slice(0, 7),
      amount: existing.amount.toString(),
      source: existing.source,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
