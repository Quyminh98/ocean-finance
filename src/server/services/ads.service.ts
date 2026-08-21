import { prisma } from "@/lib/db";
import { logAction, auditActorFields } from "@/server/audit/log-action";
import type { AuditMeta } from "@/server/services/employee.service";

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
  paidByAdminId?: string;
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
    ...(params.employeeId ? { employeeId: params.employeeId } : {}),
    ...(params.paidByAdminId ? { paidByAdminId: params.paidByAdminId } : {}),
    ...(search
      ? {
          OR: [
            { employee: { user: { name: { contains: search, mode: "insensitive" as const } } } },
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
        employee: { include: { user: { select: { name: true } } } },
        paidByAdmin: { select: { name: true } },
      },
    }),
  ]);

  const items: AdExpenseListItem[] = rows.map((row) => ({
    adExpenseId: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.user.name,
    expenseMonth: row.expenseMonth,
    amount: row.amount,
    note: row.note,
    paidByAdminId: row.paidByAdminId,
    paidByAdminName: row.paidByAdmin.name,
  }));

  return { items, total, page, pageSize };
}

export type CreateAdExpenseInput = {
  employeeId: string;
  expenseMonth: Date;
  amount: bigint;
  note?: string;
  paidByAdminId: string;
};

export type CreateAdExpenseResult = { adExpenseId: string; wasUpdate: boolean };

/**
 * Create AdExpense — nhập trực tiếp theo nhân viên (user request 2026-08-20,
 * đảo lại thiết kế Page-scoped trước đó). Một nhân viên chỉ có tối đa một
 * record đang hoạt động mỗi tháng (`ad_expenses_employee_month_unique`) —
 * submitting again for an employee+month that already has an active record
 * overwrites its amount/note instead of creating a second row (giữ nguyên
 * hành vi upsert-overwrite đã có từ trước).
 */
export async function createAdExpense(
  input: CreateAdExpenseInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<CreateAdExpenseResult> {
  const employee = await prisma.employeeProfile.findUnique({ where: { id: input.employeeId } });
  if (!employee) throw new AdExpenseError("Không tìm thấy nhân viên.", "NOT_FOUND");

  const payer = await prisma.user.findUnique({ where: { id: input.paidByAdminId } });
  if (!payer || payer.role !== "ADMIN") throw new AdExpenseError("Người chi không hợp lệ.", "INVALID_PAYER");

  const { row, wasUpdate, before } = await prisma.$transaction(async (tx) => {
    const existing = await tx.adExpense.findFirst({
      where: { employeeId: input.employeeId, expenseMonth: input.expenseMonth, deletedAt: null },
    });

    if (existing) {
      const updated = await tx.adExpense.update({
        where: { id: existing.id },
        data: {
          amount: input.amount,
          note: input.note ?? null,
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
        employeeId: input.employeeId,
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
      employeeId: input.employeeId,
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
  employeeId: string;
  expenseMonth: Date;
  amount: bigint;
  note?: string;
  paidByAdminId: string;
};

/** Edit AdExpense — moving to a different employee+month is allowed as long as it doesn't collide with an existing active record there. */
export async function updateAdExpense(
  adExpenseId: string,
  input: UpdateAdExpenseInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<void> {
  const existing = await prisma.adExpense.findUnique({ where: { id: adExpenseId } });
  if (!existing || existing.deletedAt) throw new AdExpenseError("Không tìm thấy chi phí Ads.", "NOT_FOUND");

  const employee = await prisma.employeeProfile.findUnique({ where: { id: input.employeeId } });
  if (!employee) throw new AdExpenseError("Không tìm thấy nhân viên.", "NOT_FOUND");

  const payer = await prisma.user.findUnique({ where: { id: input.paidByAdminId } });
  if (!payer || payer.role !== "ADMIN") throw new AdExpenseError("Người chi không hợp lệ.", "INVALID_PAYER");

  const conflict = await prisma.adExpense.findFirst({
    where: { employeeId: input.employeeId, expenseMonth: input.expenseMonth, deletedAt: null, NOT: { id: adExpenseId } },
  });
  if (conflict) {
    throw new AdExpenseError(
      "Nhân viên này đã có chi phí Ads cho tháng đó — vui lòng sửa dòng hiện có thay vì tạo trùng.",
      "MONTH_CONFLICT",
    );
  }

  const before = {
    employeeId: existing.employeeId,
    expenseMonth: existing.expenseMonth.toISOString().slice(0, 7),
    amount: existing.amount.toString(),
    note: existing.note,
    paidByAdminId: existing.paidByAdminId,
  };

  await prisma.adExpense.update({
    where: { id: adExpenseId },
    data: {
      employeeId: input.employeeId,
      expenseMonth: input.expenseMonth,
      amount: input.amount,
      note: input.note ?? null,
      paidByAdminId: input.paidByAdminId,
    },
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "UPDATE",
    entityType: "AdExpense",
    entityId: adExpenseId,
    beforeJson: before,
    afterJson: {
      employeeId: input.employeeId,
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
      employeeId: existing.employeeId,
      expenseMonth: existing.expenseMonth.toISOString().slice(0, 7),
      amount: existing.amount.toString(),
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
