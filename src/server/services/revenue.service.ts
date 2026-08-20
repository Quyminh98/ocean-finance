import { prisma } from "@/lib/db";
import { logAction, auditActorFields } from "@/server/audit/log-action";
import type { AuditMeta } from "@/server/services/employee.service";
import { resolvePageOwner } from "@/server/services/assignment.service";
import { parseMonthKey } from "@/lib/month";

export class RevenueError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export const REVENUE_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export type RevenuePageSize = (typeof REVENUE_PAGE_SIZE_OPTIONS)[number];

export type RevenueListItem = {
  revenueId: string;
  pageId: string;
  pageName: string;
  employeeId: string;
  employeeName: string;
  revenueMonth: Date;
  amount: bigint;
  note: string | null;
};

export type RevenueListResult = {
  items: RevenueListItem[];
  total: number;
  page: number;
  pageSize: RevenuePageSize;
};

export type ListRevenueParams = {
  month?: string;
  employeeId?: string;
  pageId?: string;
  search?: string;
  page?: number;
  pageSize?: RevenuePageSize;
};

export async function listRevenue(params: ListRevenueParams): Promise<RevenueListResult> {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const pageSize = params.pageSize && REVENUE_PAGE_SIZE_OPTIONS.includes(params.pageSize) ? params.pageSize : 20;
  const search = params.search?.trim();
  const monthFilter = params.month ? parseMonthKey(params.month) : null;

  const where = {
    deletedAt: null,
    ...(monthFilter ? { revenueMonth: monthFilter } : {}),
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
    prisma.revenue.count({ where }),
    prisma.revenue.findMany({
      where,
      orderBy: { revenueMonth: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { page: { select: { name: true } }, employeeSnapshot: { include: { user: { select: { name: true } } } } },
    }),
  ]);

  const items: RevenueListItem[] = rows.map((row) => ({
    revenueId: row.id,
    pageId: row.pageId,
    pageName: row.page.name,
    employeeId: row.employeeIdSnapshot,
    employeeName: row.employeeSnapshot.user.name,
    revenueMonth: row.revenueMonth,
    amount: row.amount,
    note: row.note,
  }));

  return { items, total, page, pageSize };
}

export type CreateRevenueInput = {
  pageId: string;
  revenueMonth: Date;
  amount: bigint;
  note?: string;
};

export type CreateRevenueResult = { revenueId: string; wasUpdate: boolean };

/**
 * Create Revenue — owner is always resolved server-side via `resolvePageOwner`
 * against the 1st of the month (spec §4.1/§17, CLAUDE.md), never chosen by
 * the Admin. A Page allows at most one active record per month
 * (`revenues_page_month_unique`) — submitting again for a Page+month that
 * already has an active record overwrites its amount/note instead of
 * creating a second row (confirmed with user 2026-08-18, same rule as
 * AdExpense). Resolve-then-write happens inside one transaction so a
 * concurrent transfer can't race the snapshot.
 */
export async function createRevenue(
  input: CreateRevenueInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<CreateRevenueResult> {
  const page = await prisma.page.findUnique({ where: { id: input.pageId } });
  if (!page || page.deletedAt) throw new RevenueError("Không tìm thấy Page.", "NOT_FOUND");

  const { row, wasUpdate, before } = await prisma.$transaction(async (tx) => {
    const owner = await resolvePageOwner(input.pageId, input.revenueMonth, tx);
    const existing = await tx.revenue.findFirst({
      where: { pageId: input.pageId, revenueMonth: input.revenueMonth, deletedAt: null },
    });

    if (existing) {
      const updated = await tx.revenue.update({
        where: { id: existing.id },
        data: {
          amount: input.amount,
          note: input.note ?? null,
          employeeIdSnapshot: owner.employeeId,
          assignmentIdSnapshot: owner.assignmentId,
        },
      });
      return {
        row: updated,
        wasUpdate: true,
        before: { amount: existing.amount.toString(), note: existing.note },
      };
    }

    const created = await tx.revenue.create({
      data: {
        pageId: input.pageId,
        employeeIdSnapshot: owner.employeeId,
        assignmentIdSnapshot: owner.assignmentId,
        revenueMonth: input.revenueMonth,
        amount: input.amount,
        note: input.note,
        createdByAdminId: adminId,
      },
    });
    return { row: created, wasUpdate: false, before: undefined };
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: wasUpdate ? "UPDATE" : "CREATE",
    entityType: "Revenue",
    entityId: row.id,
    beforeJson: before,
    afterJson: {
      pageId: input.pageId,
      employeeIdSnapshot: row.employeeIdSnapshot,
      revenueMonth: input.revenueMonth.toISOString().slice(0, 7),
      amount: input.amount.toString(),
      note: input.note ?? null,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { revenueId: row.id, wasUpdate };
}

export type UpdateRevenueInput = {
  pageId: string;
  revenueMonth: Date;
  amount: bigint;
  note?: string;
};

/** Edit Revenue — Page/month changes re-resolve the owner snapshot (schema.md Revenue). */
export async function updateRevenue(
  revenueId: string,
  input: UpdateRevenueInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<void> {
  const existing = await prisma.revenue.findUnique({ where: { id: revenueId } });
  if (!existing || existing.deletedAt) throw new RevenueError("Không tìm thấy doanh thu.", "NOT_FOUND");

  const page = await prisma.page.findUnique({ where: { id: input.pageId } });
  if (!page || page.deletedAt) throw new RevenueError("Không tìm thấy Page.", "NOT_FOUND");

  const conflict = await prisma.revenue.findFirst({
    where: { pageId: input.pageId, revenueMonth: input.revenueMonth, deletedAt: null, NOT: { id: revenueId } },
  });
  if (conflict) {
    throw new RevenueError("Page này đã có doanh thu cho tháng đó — vui lòng sửa dòng hiện có thay vì tạo trùng.", "MONTH_CONFLICT");
  }

  const before = {
    pageId: existing.pageId,
    employeeIdSnapshot: existing.employeeIdSnapshot,
    revenueMonth: existing.revenueMonth.toISOString().slice(0, 7),
    amount: existing.amount.toString(),
    note: existing.note,
  };

  await prisma.$transaction(async (tx) => {
    const owner = await resolvePageOwner(input.pageId, input.revenueMonth, tx);
    await tx.revenue.update({
      where: { id: revenueId },
      data: {
        pageId: input.pageId,
        employeeIdSnapshot: owner.employeeId,
        assignmentIdSnapshot: owner.assignmentId,
        revenueMonth: input.revenueMonth,
        amount: input.amount,
        note: input.note ?? null,
      },
    });
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "UPDATE",
    entityType: "Revenue",
    entityId: revenueId,
    beforeJson: before,
    afterJson: {
      pageId: input.pageId,
      revenueMonth: input.revenueMonth.toISOString().slice(0, 7),
      amount: input.amount.toString(),
      note: input.note ?? null,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/** Soft delete — sets `deletedAt`, never removes the row (CLAUDE.md "Soft delete cho dữ liệu tài chính"). */
export async function softDeleteRevenue(revenueId: string, adminId: string, meta: AuditMeta = {}): Promise<void> {
  const existing = await prisma.revenue.findUnique({ where: { id: revenueId } });
  if (!existing || existing.deletedAt) throw new RevenueError("Không tìm thấy doanh thu.", "NOT_FOUND");

  await prisma.revenue.update({ where: { id: revenueId }, data: { deletedAt: new Date() } });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "DELETE",
    entityType: "Revenue",
    entityId: revenueId,
    beforeJson: {
      pageId: existing.pageId,
      revenueMonth: existing.revenueMonth.toISOString().slice(0, 7),
      amount: existing.amount.toString(),
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
