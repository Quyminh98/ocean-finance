import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { logAction, auditActorFields } from "@/server/audit/log-action";
import type { AuditMeta } from "@/server/services/employee.service";
import { PageError } from "@/server/services/page.service";

type DbClient = typeof prisma | Prisma.TransactionClient;

export type ResolvedPageOwner = {
  employeeId: string;
  assignmentId: string;
};

/**
 * Central owner-resolution rule (spec §36 / CLAUDE.md) — bắt buộc dùng khi
 * tạo/sửa Revenue và AdExpense (Phase 5/6). Accepts an optional transaction
 * client so callers can resolve-then-write atomically.
 */
export async function resolvePageOwner(
  pageId: string,
  occurredAt: Date,
  client: DbClient = prisma,
): Promise<ResolvedPageOwner> {
  const assignments = await client.pageAssignment.findMany({
    where: {
      pageId,
      startedAt: { lte: occurredAt },
      OR: [{ endedAt: null }, { endedAt: { gt: occurredAt } }],
    },
  });

  if (assignments.length === 0) {
    throw new PageError(
      "Page chưa có nhân viên phụ trách hợp lệ tại ngày này — không thể tạo record.",
      "NO_ASSIGNMENT",
    );
  }
  if (assignments.length > 1) {
    throw new PageError(
      "Dữ liệu PageAssignment không nhất quán: nhiều assignment cùng hợp lệ tại một thời điểm.",
      "DATA_INTEGRITY_ERROR",
    );
  }

  const assignment = assignments[0];
  return { employeeId: assignment.employeeId, assignmentId: assignment.id };
}

export type AssignmentHistoryItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  startedAt: Date;
  endedAt: Date | null;
  note: string | null;
};

export async function getAssignmentHistory(pageId: string): Promise<AssignmentHistoryItem[]> {
  const rows = await prisma.pageAssignment.findMany({
    where: { pageId },
    orderBy: { startedAt: "desc" },
    include: { employee: { include: { user: { select: { name: true } } } } },
  });

  return rows.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.user.name,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    note: row.note,
  }));
}

export type EmployeeAssignmentHistoryItem = {
  id: string;
  pageId: string;
  pageName: string;
  startedAt: Date;
  endedAt: Date | null;
  note: string | null;
};

/** All Pages an employee currently manages or has ever managed, most recent first (spec §14.3/§12 "Pages"). */
export async function getEmployeeAssignmentHistory(employeeId: string): Promise<EmployeeAssignmentHistoryItem[]> {
  const rows = await prisma.pageAssignment.findMany({
    where: { employeeId },
    orderBy: { startedAt: "desc" },
    include: { page: { select: { name: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    pageId: row.pageId,
    pageName: row.page.name,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    note: row.note,
  }));
}

export type AssignEmployeeInput = {
  employeeId: string;
  effectiveDate: Date;
  note?: string;
};

/**
 * First-time assignment for a Page that currently has no active
 * PageAssignment at all (created without one, per user request — see
 * `createPage`). Distinct from `transferPage`, which requires an existing
 * active assignment to close first.
 *
 * If the Page was created with `purchasePrice > 0` and has no
 * PagePurchaseExpense yet (deferred because no one was assigned at
 * creation), one is snapshotted here to this employee — preserving "whoever
 * receives the Page first owns the purchase cost" even though the timing is
 * now decoupled from Page creation. The payer was already captured on the
 * Page itself at creation time (`page.paidByAdminId`) — never asked again here.
 */
export async function assignEmployee(
  pageId: string,
  input: AssignEmployeeInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<void> {
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page || page.deletedAt) throw new PageError("Không tìm thấy Page.", "NOT_FOUND");

  const employee = await prisma.employeeProfile.findUnique({ where: { id: input.employeeId }, include: { user: true } });
  if (!employee) throw new PageError("Không tìm thấy nhân viên.", "NOT_FOUND");
  if (employee.user.status !== "ACTIVE") {
    throw new PageError("Nhân viên được gán phải đang ở trạng thái hoạt động.", "EMPLOYEE_INACTIVE");
  }

  const activeAssignment = await prisma.pageAssignment.findFirst({ where: { pageId, endedAt: null } });
  if (activeAssignment) {
    throw new PageError("Page đã có nhân viên phụ trách — dùng “Chuyển giao” để đổi nhân viên.", "ALREADY_ASSIGNED");
  }

  const existingPurchaseExpense = await prisma.pagePurchaseExpense.findUnique({ where: { pageId } });
  const willCreatePurchaseExpense = page.purchasePrice > 0n && !existingPurchaseExpense;
  if (willCreatePurchaseExpense && !page.paidByAdminId) {
    // Shouldn't happen — createPage() requires paidByAdminId whenever purchasePrice > 0 — but guard defensively.
    throw new PageError("Page chưa có người chi cho khoản mua — vui lòng cập nhật lại Page.", "MISSING_PAYER");
  }

  const { assignment, purchaseExpense } = await prisma.$transaction(async (tx) => {
    const assignment = await tx.pageAssignment.create({
      data: {
        pageId,
        employeeId: input.employeeId,
        startedAt: input.effectiveDate,
        assignedByAdminId: adminId,
        note: input.note,
      },
    });

    const purchaseExpense = willCreatePurchaseExpense
      ? await tx.pagePurchaseExpense.create({
          data: {
            pageId,
            employeeIdSnapshot: input.employeeId,
            assignmentIdSnapshot: assignment.id,
            purchaseMonth: page.purchaseMonth,
            amount: page.purchasePrice,
            createdByAdminId: adminId,
            paidByAdminId: page.paidByAdminId!,
          },
        })
      : null;

    return { assignment, purchaseExpense };
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "ASSIGN",
    entityType: "Page",
    entityId: pageId,
    afterJson: {
      employeeId: input.employeeId,
      assignmentId: assignment.id,
      effectiveDate: input.effectiveDate.toISOString().slice(0, 10),
      purchaseExpenseId: purchaseExpense?.id ?? null,
      paidByAdminId: purchaseExpense ? page.paidByAdminId : null,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export type TransferPageInput = {
  newEmployeeId: string;
  effectiveDate: Date;
  note?: string;
};

/**
 * Transfer Page — close the active assignment and open a new one (spec §15.4
 * / §44). Never touches Revenue/AdExpense/PagePurchaseExpense already
 * created under the old assignment (snapshot pattern, CLAUDE.md).
 */
export async function transferPage(
  pageId: string,
  input: TransferPageInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<void> {
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page || page.deletedAt) throw new PageError("Không tìm thấy Page.", "NOT_FOUND");

  const newEmployee = await prisma.employeeProfile.findUnique({
    where: { id: input.newEmployeeId },
    include: { user: true },
  });
  if (!newEmployee) throw new PageError("Không tìm thấy nhân viên.", "NOT_FOUND");
  if (newEmployee.user.status !== "ACTIVE") {
    throw new PageError("Nhân viên mới phải đang ở trạng thái hoạt động.", "EMPLOYEE_INACTIVE");
  }

  const activeAssignment = await prisma.pageAssignment.findFirst({ where: { pageId, endedAt: null } });
  if (!activeAssignment) {
    throw new PageError("Page chưa có nhân viên phụ trách để chuyển giao.", "NO_ACTIVE_ASSIGNMENT");
  }
  if (activeAssignment.employeeId === input.newEmployeeId) {
    throw new PageError("Nhân viên mới trùng với nhân viên đang phụ trách.", "SAME_EMPLOYEE");
  }
  if (input.effectiveDate <= activeAssignment.startedAt) {
    throw new PageError(
      "Ngày hiệu lực phải sau ngày bắt đầu phụ trách hiện tại của nhân viên đang quản lý.",
      "INVALID_EFFECTIVE_DATE",
    );
  }

  const newAssignment = await prisma.$transaction(async (tx) => {
    await tx.pageAssignment.update({
      where: { id: activeAssignment.id },
      data: { endedAt: input.effectiveDate },
    });
    return tx.pageAssignment.create({
      data: {
        pageId,
        employeeId: input.newEmployeeId,
        startedAt: input.effectiveDate,
        assignedByAdminId: adminId,
        note: input.note,
      },
    });
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "TRANSFER",
    entityType: "Page",
    entityId: pageId,
    beforeJson: { employeeId: activeAssignment.employeeId, assignmentId: activeAssignment.id },
    afterJson: {
      employeeId: input.newEmployeeId,
      assignmentId: newAssignment.id,
      effectiveDate: input.effectiveDate.toISOString().slice(0, 10),
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
