import { prisma } from "@/lib/db";
import { logAction, auditActorFields } from "@/server/audit/log-action";
import { EmployeeError, type AuditMeta } from "@/server/services/employee.service";
import type { UserStatus } from "@/generated/prisma/client";

export type SalaryHistoryItem = {
  id: string;
  monthlySalary: bigint;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  paidByAdminId: string;
};

export async function getSalaryHistory(employeeId: string): Promise<SalaryHistoryItem[]> {
  const rows = await prisma.salaryHistory.findMany({
    where: { employeeId },
    orderBy: { effectiveFrom: "desc" },
    select: { id: true, monthlySalary: true, effectiveFrom: true, effectiveTo: true, paidByAdminId: true },
  });
  return rows;
}

export const SALARY_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export type SalaryPageSize = (typeof SALARY_PAGE_SIZE_OPTIONS)[number];

export type EmployeeSalaryListItem = {
  employeeId: string;
  name: string;
  email: string;
  status: UserStatus;
  currentSalary: bigint;
  currentEffectiveFrom: Date | null;
  currentPaidByAdminName: string | null;
};

export type ListEmployeeSalariesParams = {
  search?: string;
  page?: number;
  pageSize?: SalaryPageSize;
};

/**
 * Dedicated "Lương" list under Tài chính (bổ sung sau Phase 13, đã xác nhận
 * với user 2026-08-17) — cùng dữ liệu SalaryHistory đã có từ Phase 3, chỉ
 * thêm chỗ xem/đổi lương tập trung thay vì phải vào từng Employee Detail.
 */
export async function listEmployeeSalaries(params: ListEmployeeSalariesParams): Promise<{
  items: EmployeeSalaryListItem[];
  total: number;
  page: number;
  pageSize: SalaryPageSize;
}> {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const pageSize = params.pageSize && SALARY_PAGE_SIZE_OPTIONS.includes(params.pageSize) ? params.pageSize : 20;
  const search = params.search?.trim();

  const where = {
    role: "USER" as const,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        employeeProfile: {
          include: {
            salaryHistories: {
              where: { effectiveTo: null },
              take: 1,
              include: { paidByAdmin: { select: { name: true } } },
            },
          },
        },
      },
    }),
  ]);

  const items: EmployeeSalaryListItem[] = users
    .filter((user) => user.employeeProfile)
    .map((user) => {
      const profile = user.employeeProfile!;
      const current = profile.salaryHistories[0] ?? null;
      return {
        employeeId: profile.id,
        name: user.name,
        email: user.email,
        status: user.status,
        currentSalary: current?.monthlySalary ?? 0n,
        currentEffectiveFrom: current?.effectiveFrom ?? null,
        currentPaidByAdminName: current?.paidByAdmin.name ?? null,
      };
    });

  return { items, total, page, pageSize };
}

export type SetEmployeeSalaryInput = {
  monthlySalary: bigint;
  effectiveFrom: Date;
  paidByAdminId: string;
};

/**
 * Creates a new SalaryHistory row and closes the currently-active one
 * (effective_to = new effective_from) in a single transaction — spec §44
 * "Change salary". The [effective_from, effective_to) intervals stay
 * contiguous and non-overlapping (schema.md SalaryHistory constraint).
 *
 * Since the UI no longer lets Admin pick `effectiveFrom` (user request
 * 2026-08-18 — it's always "today", stamped server-side), a second edit on
 * the same day is a normal thing to happen, not a data error. When
 * `input.effectiveFrom` equals the current row's `effectiveFrom` exactly,
 * this **overwrites that row in place** instead of closing it and creating a
 * new one — otherwise it'd produce a zero-length `[today, today)` history
 * row, and two rows tied on the same `effectiveFrom` make "which one is the
 * rate for this month" ambiguous for `salaryForMonth`/`systemSalaryCostForMonth`
 * (dashboard.service.ts / employee.service.ts). A genuinely earlier
 * `effectiveFrom` than the current row is still rejected — defensive check,
 * not reachable through the UI anymore but guards direct service callers.
 */
export async function setEmployeeSalary(
  employeeId: string,
  input: SetEmployeeSalaryInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<SalaryHistoryItem> {
  const profile = await prisma.employeeProfile.findUnique({ where: { id: employeeId } });
  if (!profile) throw new EmployeeError("Không tìm thấy nhân viên.", "NOT_FOUND");

  const payer = await prisma.user.findUnique({ where: { id: input.paidByAdminId } });
  if (!payer || payer.role !== "ADMIN") throw new EmployeeError("Người chi không hợp lệ.", "INVALID_PAYER");

  const current = await prisma.salaryHistory.findFirst({ where: { employeeId, effectiveTo: null } });

  if (current && input.effectiveFrom < current.effectiveFrom) {
    throw new EmployeeError(
      "Ngày hiệu lực không được trước ngày hiệu lực của mức lương hiện tại.",
      "INVALID_EFFECTIVE_DATE",
    );
  }

  const sameDayEdit = Boolean(current) && input.effectiveFrom.getTime() === current!.effectiveFrom.getTime();

  const result = await prisma.$transaction(async (tx) => {
    if (sameDayEdit) {
      return tx.salaryHistory.update({
        where: { id: current!.id },
        data: { monthlySalary: input.monthlySalary, paidByAdminId: input.paidByAdminId },
      });
    }
    if (current) {
      await tx.salaryHistory.update({ where: { id: current.id }, data: { effectiveTo: input.effectiveFrom } });
    }
    return tx.salaryHistory.create({
      data: {
        employeeId,
        monthlySalary: input.monthlySalary,
        effectiveFrom: input.effectiveFrom,
        createdByAdminId: adminId,
        paidByAdminId: input.paidByAdminId,
      },
    });
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: sameDayEdit ? "UPDATE" : "CHANGE_SALARY",
    entityType: "SalaryHistory",
    entityId: result.id,
    beforeJson: current
      ? {
          monthlySalary: current.monthlySalary.toString(),
          effectiveFrom: current.effectiveFrom.toISOString().slice(0, 10),
          paidByAdminId: current.paidByAdminId,
        }
      : null,
    afterJson: {
      monthlySalary: input.monthlySalary.toString(),
      effectiveFrom: input.effectiveFrom.toISOString().slice(0, 10),
      paidByAdminId: input.paidByAdminId,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return result;
}
