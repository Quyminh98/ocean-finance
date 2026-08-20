import { prisma } from "@/lib/db";
import { logAction, auditActorFields } from "@/server/audit/log-action";
import type { AuditMeta } from "@/server/services/employee.service";

export class AdminExpenseError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export const ADMIN_EXPENSE_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export type AdminExpensePageSize = (typeof ADMIN_EXPENSE_PAGE_SIZE_OPTIONS)[number];

export type AdminExpenseListItem = {
  adminExpenseId: string;
  expenseDate: Date;
  amount: bigint;
  description: string;
  note: string | null;
  createdByAdminId: string;
  createdByAdminName: string;
  paidByAdminId: string;
  paidByAdminName: string;
  deletedAt: Date | null;
};

export type AdminExpenseListResult = {
  items: AdminExpenseListItem[];
  total: number;
  page: number;
  pageSize: AdminExpensePageSize;
};

export type ListAdminExpensesParams = {
  month?: string;
  createdByAdminId?: string;
  page?: number;
  pageSize?: AdminExpensePageSize;
  /** Restore view (spec §19/§28 "Có thể restore bởi Admin") — default lists active rows only. */
  deleted?: boolean;
};

/** Parses a "YYYY-MM" month key into a [gte, lt) Date range for filtering `expenseDate`. */
function monthRange(month: string): { gte: Date; lt: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return { gte: new Date(Date.UTC(year, monthIndex, 1)), lt: new Date(Date.UTC(year, monthIndex + 1, 1)) };
}

export async function listAdminExpenses(params: ListAdminExpensesParams): Promise<AdminExpenseListResult> {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const pageSize = params.pageSize && ADMIN_EXPENSE_PAGE_SIZE_OPTIONS.includes(params.pageSize) ? params.pageSize : 20;
  const range = params.month ? monthRange(params.month) : null;

  const where = {
    deletedAt: params.deleted ? { not: null } : null,
    ...(range ? { expenseDate: { gte: range.gte, lt: range.lt } } : {}),
    ...(params.createdByAdminId ? { createdByAdminId: params.createdByAdminId } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.adminExpense.count({ where }),
    prisma.adminExpense.findMany({
      where,
      orderBy: { expenseDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        createdByAdmin: { select: { name: true } },
        paidByAdmin: { select: { name: true } },
      },
    }),
  ]);

  const items: AdminExpenseListItem[] = rows.map((row) => ({
    adminExpenseId: row.id,
    expenseDate: row.expenseDate,
    amount: row.amount,
    description: row.description,
    note: row.note,
    createdByAdminId: row.createdByAdminId,
    createdByAdminName: row.createdByAdmin.name,
    paidByAdminId: row.paidByAdminId,
    paidByAdminName: row.paidByAdmin.name,
    deletedAt: row.deletedAt,
  }));

  return { items, total, page, pageSize };
}

export type CreateAdminExpenseInput = {
  expenseDate: Date;
  amount: bigint;
  description: string;
  note?: string;
  paidByAdminId: string;
};

export type CreateAdminExpenseResult = { adminExpenseId: string };

export async function createAdminExpense(
  input: CreateAdminExpenseInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<CreateAdminExpenseResult> {
  const payer = await prisma.user.findUnique({ where: { id: input.paidByAdminId } });
  if (!payer || payer.role !== "ADMIN") throw new AdminExpenseError("Người chi không hợp lệ.", "INVALID_PAYER");

  const expense = await prisma.adminExpense.create({
    data: {
      expenseDate: input.expenseDate,
      amount: input.amount,
      description: input.description,
      note: input.note,
      createdByAdminId: adminId,
      paidByAdminId: input.paidByAdminId,
    },
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "CREATE",
    entityType: "AdminExpense",
    entityId: expense.id,
    afterJson: {
      expenseDate: input.expenseDate.toISOString().slice(0, 10),
      amount: input.amount.toString(),
      description: input.description,
      note: input.note ?? null,
      paidByAdminId: input.paidByAdminId,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { adminExpenseId: expense.id };
}

export type UpdateAdminExpenseInput = CreateAdminExpenseInput;

export async function updateAdminExpense(
  adminExpenseId: string,
  input: UpdateAdminExpenseInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<void> {
  const existing = await prisma.adminExpense.findUnique({ where: { id: adminExpenseId } });
  if (!existing || existing.deletedAt) throw new AdminExpenseError("Không tìm thấy chi phí.", "NOT_FOUND");

  const payer = await prisma.user.findUnique({ where: { id: input.paidByAdminId } });
  if (!payer || payer.role !== "ADMIN") throw new AdminExpenseError("Người chi không hợp lệ.", "INVALID_PAYER");

  const before = {
    expenseDate: existing.expenseDate.toISOString().slice(0, 10),
    amount: existing.amount.toString(),
    description: existing.description,
    note: existing.note,
    paidByAdminId: existing.paidByAdminId,
  };

  await prisma.adminExpense.update({
    where: { id: adminExpenseId },
    data: {
      expenseDate: input.expenseDate,
      amount: input.amount,
      description: input.description,
      note: input.note ?? null,
      paidByAdminId: input.paidByAdminId,
    },
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "UPDATE",
    entityType: "AdminExpense",
    entityId: adminExpenseId,
    beforeJson: before,
    afterJson: {
      expenseDate: input.expenseDate.toISOString().slice(0, 10),
      amount: input.amount.toString(),
      description: input.description,
      note: input.note ?? null,
      paidByAdminId: input.paidByAdminId,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/** Soft delete — sets `deletedAt`, never removes the row (CLAUDE.md "Soft delete cho dữ liệu tài chính"). */
export async function softDeleteAdminExpense(adminExpenseId: string, adminId: string, meta: AuditMeta = {}): Promise<void> {
  const existing = await prisma.adminExpense.findUnique({ where: { id: adminExpenseId } });
  if (!existing || existing.deletedAt) throw new AdminExpenseError("Không tìm thấy chi phí.", "NOT_FOUND");

  await prisma.adminExpense.update({ where: { id: adminExpenseId }, data: { deletedAt: new Date() } });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "DELETE",
    entityType: "AdminExpense",
    entityId: adminExpenseId,
    beforeJson: {
      expenseDate: existing.expenseDate.toISOString().slice(0, 10),
      amount: existing.amount.toString(),
      description: existing.description,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/** Restore a soft-deleted expense — the only entity with this action so far (spec §19 "Restore nếu cần", §28 "Có thể restore bởi Admin"). */
export async function restoreAdminExpense(adminExpenseId: string, adminId: string, meta: AuditMeta = {}): Promise<void> {
  const existing = await prisma.adminExpense.findUnique({ where: { id: adminExpenseId } });
  if (!existing || !existing.deletedAt) throw new AdminExpenseError("Chi phí này chưa bị xoá.", "NOT_DELETED");

  await prisma.adminExpense.update({ where: { id: adminExpenseId }, data: { deletedAt: null } });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: "RESTORE",
    entityType: "AdminExpense",
    entityId: adminExpenseId,
    beforeJson: { deletedAt: existing.deletedAt.toISOString() },
    afterJson: { deletedAt: null },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
