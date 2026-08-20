import { prisma } from "@/lib/db";
import { logAction, auditActorFields } from "@/server/audit/log-action";
import type { AuditMeta } from "@/server/services/employee.service";
import { resolvePageOwner } from "@/server/services/assignment.service";

export class AdExpenseError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export const AD_EXPENSE_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export type AdExpensePageSize = (typeof AD_EXPENSE_PAGE_SIZE_OPTIONS)[number];

export type AdExpenseListItem = {
  adExpenseId: string;
  pageId: string;
  pageName: string;
  employeeId: string;
  employeeName: string;
  expenseMonth: Date;
  amount: bigint;
  note: string | null;
  paidByAdminId: string;
  paidByAdminName: string;
};

export type AdExpenseListResult = {
  items: AdExpenseListItem[];
  total: number;
  page: number;
  pageSize: AdExpensePageSize;
};

export type ListAdExpenseParams = {
  month?: string;
  employeeId?: string;
  pageId?: string;
  search?: string;
  page?: number;
  pageSize?: AdExpensePageSize;
};

/** Parses a "YYYY-MM" month key into the normalized 1st-of-month Date used to store/compare `expenseMonth`. */
export function parseMonthKey(month: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return new Date(Date.UTC(year, monthIndex, 1));
}

export async function listAdExpenses(params: ListAdExpenseParams): Promise<AdExpenseListResult> {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const pageSize = params.pageSize && AD_EXPENSE_PAGE_SIZE_OPTIONS.includes(params.pageSize) ? params.pageSize : 20;
  const search = params.search?.trim();
  const monthFilter = params.month ? parseMonthKey(params.month) : null;

  const where = {
    deletedAt: null,
    ...(monthFilter ? { expenseMonth: monthFilter } : {}),
    ...(params.employeeId ? { employeeIdSnapshot: params.employeeId } : {}),
    ...(params.pageId ? { pageId: params.pageId } : {}),
    ...(search
      ? {
          OR: [
            { page: { name: { contains: search, mode: "insensitive" as const } } },
            { note: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.adExpense.count({ where }),
    prisma.adExpense.findMany({
      where,
      orderBy: { expenseMonth: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        page: { select: { name: true } },
        employeeSnapshot: { include: { user: { select: { name: true } } } },
        paidByAdmin: { select: { name: true } },
      },
    }),
  ]);

  const items: AdExpenseListItem[] = rows.map((row) => ({
    adExpenseId: row.id,
    pageId: row.pageId,
    pageName: row.page.name,
    employeeId: row.employeeIdSnapshot,
    employeeName: row.employeeSnapshot.user.name,
    expenseMonth: row.expenseMonth,
    amount: row.amount,
    note: row.note,
    paidByAdminId: row.paidByAdminId,
    paidByAdminName: row.paidByAdmin.name,
  }));

  return { items, total, page, pageSize };
}

export type CreateAdExpenseInput = {
  pageId: string;
  expenseMonth: Date;
  amount: bigint;
  note?: string;
  paidByAdminId: string;
};

export type CreateAdExpenseResult = { adExpenseId: string; wasUpdate: boolean };

/**
 * Create AdExpense — owner is always resolved server-side via `resolvePageOwner`
 * against the 1st of the month (spec §6, CLAUDE.md), never chosen by the
 * Admin. A Page allows at most one active record per month
 * (`ad_expenses_page_month_unique`) — submitting again for a Page+month that
 * already has an active record overwrites its amount/note instead of
 * creating a second row (confirmed with user 2026-08-17).
 */
export async function createAdExpense(
  input: CreateAdExpenseInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<CreateAdExpenseResult> {
  const page = await prisma.page.findUnique({ where: { id: input.pageId } });
  if (!page || page.deletedAt) throw new AdExpenseError("Không tìm thấy Page.", "NOT_FOUND");

  const payer = await prisma.user.findUnique({ where: { id: input.paidByAdminId } });
  if (!payer || payer.role !== "ADMIN") throw new AdExpenseError("Người chi không hợp lệ.", "INVALID_PAYER");

  const { row, wasUpdate, before } = await prisma.$transaction(async (tx) => {
    const owner = await resolvePageOwner(input.pageId, input.expenseMonth, tx);
    const existing = await tx.adExpense.findFirst({
      where: { pageId: input.pageId, expenseMonth: input.expenseMonth, deletedAt: null },
    });

    if (existing) {
      const updated = await tx.adExpense.update({
        where: { id: existing.id },
        data: {
          amount: input.amount,
          note: input.note ?? null,
          employeeIdSnapshot: owner.employeeId,
          assignmentIdSnapshot: owner.assignmentId,
          paidByAdminId: input.paidByAdminId,
        },
      });
      return {
        row: updated,
        wasUpdate: true,
        before: { amount: existing.amount.toString(), note: existing.note, paidByAdminId: existing.paidByAdminId },
      };
    }

    const created = await tx.adExpense.create({
      data: {
        pageId: input.pageId,
        employeeIdSnapshot: owner.employeeId,
        assignmentIdSnapshot: owner.assignmentId,
        expenseMonth: input.expenseMonth,
        amount: input.amount,
        note: input.note,
        createdByAdminId: adminId,
        paidByAdminId: input.paidByAdminId,
      },
    });
    return { row: created, wasUpdate: false, before: undefined };
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: wasUpdate ? "UPDATE" : "CREATE",
    entityType: "AdExpense",
    entityId: row.id,
    beforeJson: before,
    afterJson: {
      pageId: input.pageId,
      employeeIdSnapshot: row.employeeIdSnapshot,
      expenseMonth: input.expenseMonth.toISOString().slice(0, 7),
      amount: input.amount.toString(),
      note: input.note ?? null,
      paidByAdminId: input.paidByAdminId,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { adExpenseId: row.id, wasUpdate };
}

export type UpdateAdExpenseInput = {
  pageId: string;
  expenseMonth: Date;
  amount: bigint;
  note?: string;
  paidByAdminId: string;
};

/** Edit AdExpense — Page/month changes re-resolve the owner snapshot (schema.md AdExpense). */
export async function updateAdExpense(
  adExpenseId: string,
  input: UpdateAdExpenseInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<void> {
  const existing = await prisma.adExpense.findUnique({ where: { id: adExpenseId } });
  if (!existing || existing.deletedAt) throw new AdExpenseError("Không tìm thấy chi phí Ads.", "NOT_FOUND");

  const page = await prisma.page.findUnique({ where: { id: input.pageId } });
  if (!page || page.deletedAt) throw new AdExpenseError("Không tìm thấy Page.", "NOT_FOUND");

  const payer = await prisma.user.findUnique({ where: { id: input.paidByAdminId } });
  if (!payer || payer.role !== "ADMIN") throw new AdExpenseError("Người chi không hợp lệ.", "INVALID_PAYER");

  const conflict = await prisma.adExpense.findFirst({
    where: { pageId: input.pageId, expenseMonth: input.expenseMonth, deletedAt: null, NOT: { id: adExpenseId } },
  });
  if (conflict) {
    throw new AdExpenseError("Page này đã có chi phí Ads cho tháng đó — vui lòng sửa dòng hiện có thay vì tạo trùng.", "MONTH_CONFLICT");
  }

  const before = {
    pageId: existing.pageId,
    employeeIdSnapshot: existing.employeeIdSnapshot,
    expenseMonth: existing.expenseMonth.toISOString().slice(0, 7),
    amount: existing.amount.toString(),
    note: existing.note,
    paidByAdminId: existing.paidByAdminId,
  };

  await prisma.$transaction(async (tx) => {
    const owner = await resolvePageOwner(input.pageId, input.expenseMonth, tx);
    await tx.adExpense.update({
      where: { id: adExpenseId },
      data: {
        pageId: input.pageId,
        employeeIdSnapshot: owner.employeeId,
        assignmentIdSnapshot: owner.assignmentId,
        expenseMonth: input.expenseMonth,
        amount: input.amount,
        note: input.note ?? null,
        paidByAdminId: input.paidByAdminId,
      },
    });
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "UPDATE",
    entityType: "AdExpense",
    entityId: adExpenseId,
    beforeJson: before,
    afterJson: {
      pageId: input.pageId,
      expenseMonth: input.expenseMonth.toISOString().slice(0, 7),
      amount: input.amount.toString(),
      note: input.note ?? null,
      paidByAdminId: input.paidByAdminId,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/** Soft delete — sets `deletedAt`, never removes the row (CLAUDE.md "Soft delete cho dữ liệu tài chính"). */
export async function softDeleteAdExpense(adExpenseId: string, adminId: string, meta: AuditMeta = {}): Promise<void> {
  const existing = await prisma.adExpense.findUnique({ where: { id: adExpenseId } });
  if (!existing || existing.deletedAt) throw new AdExpenseError("Không tìm thấy chi phí Ads.", "NOT_FOUND");

  await prisma.adExpense.update({ where: { id: adExpenseId }, data: { deletedAt: new Date() } });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "DELETE",
    entityType: "AdExpense",
    entityId: adExpenseId,
    beforeJson: {
      pageId: existing.pageId,
      expenseMonth: existing.expenseMonth.toISOString().slice(0, 7),
      amount: existing.amount.toString(),
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
