import { prisma } from "@/lib/db";
import { logAction } from "@/server/audit/log-action";
import { parseMonthKey } from "@/lib/month";
import type { AuditMeta } from "@/server/services/employee.service";

// Tiền nhân viên THỰC NHẬN (user request 2026-08-18) — thuần bản ghi để xem,
// KHÔNG cộng vào Employee Cost/Revenue (getEmployeeFinancials) hay bất kỳ
// công thức tài chính nào khác (Total Expenses, Profit...). Không join/sum
// với bất kỳ service nào khác — giữ tách biệt hoàn toàn, đúng yêu cầu.

export class EmployeeReceiptError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export const EMPLOYEE_RECEIPT_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export type EmployeeReceiptPageSize = (typeof EMPLOYEE_RECEIPT_PAGE_SIZE_OPTIONS)[number];

export type EmployeeReceiptListItem = {
  employeeReceiptId: string;
  employeeId: string;
  employeeName: string;
  receiptMonth: Date;
  amount: bigint;
  note: string | null;
  createdByAdminId: string;
  createdByAdminName: string;
};

export type EmployeeReceiptListResult = {
  items: EmployeeReceiptListItem[];
  total: number;
  page: number;
  pageSize: EmployeeReceiptPageSize;
};

export type ListEmployeeReceiptsParams = {
  month?: string;
  employeeId?: string;
  page?: number;
  pageSize?: EmployeeReceiptPageSize;
};

export async function listEmployeeReceipts(params: ListEmployeeReceiptsParams): Promise<EmployeeReceiptListResult> {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const pageSize = params.pageSize && EMPLOYEE_RECEIPT_PAGE_SIZE_OPTIONS.includes(params.pageSize) ? params.pageSize : 20;
  const monthFilter = params.month ? parseMonthKey(params.month) : null;

  const where = {
    deletedAt: null,
    ...(monthFilter ? { receiptMonth: monthFilter } : {}),
    ...(params.employeeId ? { employeeId: params.employeeId } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.employeeReceipt.count({ where }),
    prisma.employeeReceipt.findMany({
      where,
      orderBy: { receiptMonth: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { employee: { include: { user: { select: { name: true } } } }, createdByAdmin: { select: { name: true } } },
    }),
  ]);

  const items: EmployeeReceiptListItem[] = rows.map((row) => ({
    employeeReceiptId: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.user.name,
    receiptMonth: row.receiptMonth,
    amount: row.amount,
    note: row.note,
    createdByAdminId: row.createdByAdminId,
    createdByAdminName: row.createdByAdmin.name,
  }));

  return { items, total, page, pageSize };
}

export type CreateEmployeeReceiptInput = {
  employeeId: string;
  receiptMonth: Date;
  amount: bigint;
  note?: string;
};

export type CreateEmployeeReceiptResult = { employeeReceiptId: string; wasUpdate: boolean };

/**
 * Create Employee Receipt — at most one active record per employee+month
 * (`employee_receipts_employee_month_unique`). Submitting again for an
 * employee+month that already has an active record overwrites its
 * amount/note instead of creating a second row (same rule as Revenue/AdExpense).
 */
export async function createEmployeeReceipt(
  input: CreateEmployeeReceiptInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<CreateEmployeeReceiptResult> {
  const employee = await prisma.employeeProfile.findUnique({ where: { id: input.employeeId } });
  if (!employee) throw new EmployeeReceiptError("Không tìm thấy nhân viên.", "NOT_FOUND");

  const { row, wasUpdate, before } = await prisma.$transaction(async (tx) => {
    const existing = await tx.employeeReceipt.findFirst({
      where: { employeeId: input.employeeId, receiptMonth: input.receiptMonth, deletedAt: null },
    });

    if (existing) {
      const updated = await tx.employeeReceipt.update({
        where: { id: existing.id },
        data: { amount: input.amount, note: input.note ?? null },
      });
      return {
        row: updated,
        wasUpdate: true,
        before: { amount: existing.amount.toString(), note: existing.note },
      };
    }

    const created = await tx.employeeReceipt.create({
      data: {
        employeeId: input.employeeId,
        receiptMonth: input.receiptMonth,
        amount: input.amount,
        note: input.note,
        createdByAdminId: adminId,
      },
    });
    return { row: created, wasUpdate: false, before: undefined };
  });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: wasUpdate ? "UPDATE" : "CREATE",
    entityType: "EmployeeReceipt",
    entityId: row.id,
    beforeJson: before,
    afterJson: {
      employeeId: input.employeeId,
      receiptMonth: input.receiptMonth.toISOString().slice(0, 7),
      amount: input.amount.toString(),
      note: input.note ?? null,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { employeeReceiptId: row.id, wasUpdate };
}

export type UpdateEmployeeReceiptInput = CreateEmployeeReceiptInput;

/** Edit — changing employee/month rejects on conflict rather than silently overwriting (same asymmetry as Revenue). */
export async function updateEmployeeReceipt(
  employeeReceiptId: string,
  input: UpdateEmployeeReceiptInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<void> {
  const existing = await prisma.employeeReceipt.findUnique({ where: { id: employeeReceiptId } });
  if (!existing || existing.deletedAt) throw new EmployeeReceiptError("Không tìm thấy khoản đã nhận.", "NOT_FOUND");

  const employee = await prisma.employeeProfile.findUnique({ where: { id: input.employeeId } });
  if (!employee) throw new EmployeeReceiptError("Không tìm thấy nhân viên.", "NOT_FOUND");

  const conflict = await prisma.employeeReceipt.findFirst({
    where: { employeeId: input.employeeId, receiptMonth: input.receiptMonth, deletedAt: null, NOT: { id: employeeReceiptId } },
  });
  if (conflict) {
    throw new EmployeeReceiptError(
      "Nhân viên này đã có khoản đã nhận cho tháng đó — vui lòng sửa dòng hiện có thay vì tạo trùng.",
      "MONTH_CONFLICT",
    );
  }

  const before = {
    employeeId: existing.employeeId,
    receiptMonth: existing.receiptMonth.toISOString().slice(0, 7),
    amount: existing.amount.toString(),
    note: existing.note,
  };

  await prisma.employeeReceipt.update({
    where: { id: employeeReceiptId },
    data: {
      employeeId: input.employeeId,
      receiptMonth: input.receiptMonth,
      amount: input.amount,
      note: input.note ?? null,
    },
  });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: "UPDATE",
    entityType: "EmployeeReceipt",
    entityId: employeeReceiptId,
    beforeJson: before,
    afterJson: {
      employeeId: input.employeeId,
      receiptMonth: input.receiptMonth.toISOString().slice(0, 7),
      amount: input.amount.toString(),
      note: input.note ?? null,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/** Soft delete — sets `deletedAt`, never removes the row (CLAUDE.md "Soft delete cho dữ liệu tài chính"). */
export async function softDeleteEmployeeReceipt(employeeReceiptId: string, adminId: string, meta: AuditMeta = {}): Promise<void> {
  const existing = await prisma.employeeReceipt.findUnique({ where: { id: employeeReceiptId } });
  if (!existing || existing.deletedAt) throw new EmployeeReceiptError("Không tìm thấy khoản đã nhận.", "NOT_FOUND");

  await prisma.employeeReceipt.update({ where: { id: employeeReceiptId }, data: { deletedAt: new Date() } });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: "DELETE",
    entityType: "EmployeeReceipt",
    entityId: employeeReceiptId,
    beforeJson: {
      employeeId: existing.employeeId,
      receiptMonth: existing.receiptMonth.toISOString().slice(0, 7),
      amount: existing.amount.toString(),
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
