import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/server/auth/password";
import { logAction, auditActorFields } from "@/server/audit/log-action";
import { parseMonthKey, monthDateRange, shiftMonthKey } from "@/lib/month";
import { currentMonthKey } from "@/lib/dates";
import type { UserStatus } from "@/generated/prisma/client";

export class EmployeeError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export type AuditMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Set only by `src/mcp/server.ts` — overrides the audit log actor to
   * `actorType: "MCP"` (spec §53) instead of the default `USER`/`adminId`. */
  actorMcpClientId?: string | null;
};

export const EMPLOYEE_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export type EmployeePageSize = (typeof EMPLOYEE_PAGE_SIZE_OPTIONS)[number];

export type EmployeeListItem = {
  employeeId: string;
  userId: string;
  name: string;
  email: string;
  status: UserStatus;
  currentSalary: bigint;
  activePages: number;
  revenue: bigint;
  totalCost: bigint;
};

export type EmployeeListResult = {
  items: EmployeeListItem[];
  total: number;
  page: number;
  pageSize: EmployeePageSize;
};

export type ListEmployeesParams = {
  search?: string;
  /** "YYYY-MM" — when omitted, Revenue/Total Cost are all-time sums (spec §14.1 "theo filter"). */
  month?: string;
  /** Never wired into the Web Employee List UI (Phase 3 kept it to Search only) — added for `list_employees` (spec §32, Phase 15), which lists it as a filter. */
  status?: UserStatus;
  page?: number;
  pageSize?: EmployeePageSize;
};

export async function listEmployees(params: ListEmployeesParams): Promise<EmployeeListResult> {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const pageSize = params.pageSize && EMPLOYEE_PAGE_SIZE_OPTIONS.includes(params.pageSize) ? params.pageSize : 20;
  const search = params.search?.trim();

  const where = {
    role: "USER" as const,
    ...(params.status ? { status: params.status } : {}),
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
            salaryHistories: { where: { effectiveTo: null }, take: 1 },
            pageAssignments: { where: { endedAt: null }, select: { id: true } },
          },
        },
      },
    }),
  ]);

  // Small internal tool (~8 employees, plan.md/CLAUDE.md "ưu tiên đơn giản, không
  // tối ưu hoá sớm") — one financials lookup per row on the current page is fine.
  const financials = await Promise.all(
    users.map((user) =>
      user.employeeProfile ? getEmployeeFinancials(user.employeeProfile.id, params.month) : Promise.resolve(null),
    ),
  );

  const items: EmployeeListItem[] = users.map((user, index) => {
    const profile = user.employeeProfile;
    const stats = financials[index];
    return {
      employeeId: profile?.id ?? "",
      userId: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      currentSalary: profile?.salaryHistories[0]?.monthlySalary ?? 0n,
      activePages: profile?.pageAssignments.length ?? 0,
      revenue: stats?.revenue ?? 0n,
      totalCost: stats?.totalCost ?? 0n,
    };
  });

  return { items, total, page, pageSize };
}

export type EmployeeDetail = {
  employeeId: string;
  userId: string;
  name: string;
  email: string;
  status: UserStatus;
  currentSalary: bigint;
  activePages: number;
  createdAt: Date;
};

export async function getEmployeeDetail(employeeId: string): Promise<EmployeeDetail | null> {
  const profile = await prisma.employeeProfile.findUnique({
    where: { id: employeeId },
    include: {
      user: true,
      salaryHistories: { where: { effectiveTo: null }, take: 1 },
      pageAssignments: { where: { endedAt: null }, select: { id: true } },
    },
  });
  if (!profile) return null;

  return {
    employeeId: profile.id,
    userId: profile.user.id,
    name: profile.user.name,
    email: profile.user.email,
    status: profile.user.status,
    currentSalary: profile.salaryHistories[0]?.monthlySalary ?? 0n,
    activePages: profile.pageAssignments.length,
    createdAt: profile.createdAt,
  };
}

/** Reads the current user's own employee profile — never accepts a caller-supplied employeeId (RBAC: self-only). */
export async function getEmployeeDetailByUserId(userId: string): Promise<EmployeeDetail | null> {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return null;
  return getEmployeeDetail(profile.id);
}

function generateTempPassword(): string {
  // 12 random bytes -> 16-char base64url string; readable enough to hand off once, strong enough to hash.
  return randomBytes(12).toString("base64url");
}

export type CreateEmployeeInput = {
  name: string;
  email: string;
  status: UserStatus;
  // Admin-provided password (Web UI, user request 2026-08-19). Omitted by
  // the MCP `create_employee` tool, which keeps auto-generating one instead
  // — an AI agent shouldn't invent a human's login password.
  password?: string;
};

export type CreateEmployeeResult = {
  userId: string;
  employeeId: string;
  tempPassword: string;
};

/**
 * No SalaryHistory is created here (spec §14.2) — a new employee has
 * "Current Salary" = 0 until Admin sets one via `setEmployeeSalary` on the
 * Employee Detail page.
 */
export async function createEmployee(
  input: CreateEmployeeInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<CreateEmployeeResult> {
  const email = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new EmployeeError("Email đã được sử dụng bởi tài khoản khác.", "EMAIL_TAKEN");
  }

  const tempPassword = input.password ?? generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const { user, profile } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: input.name, email, passwordHash, role: "USER", status: input.status },
    });
    const profile = await tx.employeeProfile.create({ data: { userId: user.id } });
    return { user, profile };
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "CREATE",
    entityType: "Employee",
    entityId: profile.id,
    afterJson: { name: input.name, email, status: input.status },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { userId: user.id, employeeId: profile.id, tempPassword };
}

export type UpdateEmployeeInput = {
  name: string;
  email: string;
  status: UserStatus;
};

export async function updateEmployee(
  employeeId: string,
  input: UpdateEmployeeInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<void> {
  const profile = await prisma.employeeProfile.findUnique({
    where: { id: employeeId },
    include: { user: true },
  });
  if (!profile) throw new EmployeeError("Không tìm thấy nhân viên.", "NOT_FOUND");

  const email = input.email.toLowerCase();
  if (email !== profile.user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new EmployeeError("Email đã được sử dụng bởi tài khoản khác.", "EMAIL_TAKEN");
  }

  const before = { name: profile.user.name, email: profile.user.email, status: profile.user.status };
  await prisma.user.update({
    where: { id: profile.userId },
    data: { name: input.name, email, status: input.status },
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "UPDATE",
    entityType: "Employee",
    entityId: employeeId,
    beforeJson: before,
    afterJson: { name: input.name, email, status: input.status },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export type EmployeeOption = { employeeId: string; name: string };

/** ACTIVE employees only — for assignment pickers (Create Page / Transfer Page). */
export async function listActiveEmployeeOptions(): Promise<EmployeeOption[]> {
  const profiles = await prisma.employeeProfile.findMany({
    where: { user: { status: "ACTIVE" } },
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return profiles.map((profile) => ({ employeeId: profile.id, name: profile.user.name }));
}

/** All employees regardless of status — for filter dropdowns (Revenue/Ads), where a historical
 * snapshot may point at an employee who has since been deactivated. */
export async function listEmployeeOptions(): Promise<EmployeeOption[]> {
  const profiles = await prisma.employeeProfile.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return profiles.map((profile) => ({ employeeId: profile.id, name: profile.user.name }));
}

export async function deactivateEmployee(employeeId: string, adminId: string, meta: AuditMeta = {}): Promise<void> {
  const profile = await prisma.employeeProfile.findUnique({
    where: { id: employeeId },
    include: { user: true },
  });
  if (!profile) throw new EmployeeError("Không tìm thấy nhân viên.", "NOT_FOUND");
  if (profile.user.status === "INACTIVE") return;

  await prisma.user.update({ where: { id: profile.userId }, data: { status: "INACTIVE" } });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "DEACTIVATE",
    entityType: "Employee",
    entityId: employeeId,
    beforeJson: { status: "ACTIVE" },
    afterJson: { status: "INACTIVE" },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

// ---------------------------------------------------------------------------
// Employee financials (Phase 7) — spec §10.1/§10.2/§37.
// ---------------------------------------------------------------------------

export type EmployeeFinancials = {
  revenue: bigint;
  adsCost: bigint;
  pagePurchaseCost: bigint;
  salaryCost: bigint;
  /** Σ active EmployeeProfitSettlement.amount (user request 2026-08-19 —
   * reverses the earlier "purely internal, isolated" design: a settlement is
   * now a genuine Employee Cost component, shown as a "Bù chi phí" row
   * in Employee Detail's "Chi tiết chi phí" table. Does NOT roll up into
   * system-wide Total Expenses/Profit (spec §10.3/10.5) — those are computed
   * independently in `dashboard.service.ts` and never touch this table. */
  profitSettlementCost: bigint;
  totalCost: bigint;
};

/**
 * Salary contribution for a single "YYYY-MM" month = the LATEST SalaryHistory
 * rate overlapping that month (user request 2026-08-18: a raise set
 * mid-month counts for that same month, replacing the earlier day-1-of-month
 * convention that deferred it to the following month — same change as
 * `systemSalaryCostForMonth` in dashboard.service.ts). A row overlaps
 * `[range.gte, range.lt)` iff `effectiveFrom < range.lt` and `effectiveTo` is
 * null or after `range.gte`. If the salary changed more than once within the
 * same month, only the most recent one (max `effectiveFrom`) counts — it
 * replaces the earlier rate, they don't sum (user-reported bug 2026-08-18:
 * this used to add both together). `histories` is ordered by `effectiveFrom`
 * ascending (see the `findMany` call in `getEmployeeFinancials` below), so
 * the last match is the latest.
 */
function salaryForMonth(histories: SalaryHistoryRow[], range: { gte: Date; lt: Date }): bigint {
  const overlapping = histories.filter(
    (row) => row.effectiveFrom < range.lt && (row.effectiveTo === null || row.effectiveTo > range.gte),
  );
  return overlapping.at(-1)?.monthlySalary ?? 0n;
}

/** Whole calendar months between two Dates (ignores day-of-month — salary is a monthly rate, not prorated daily). */
function wholeMonthsBetween(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
}

export type SalaryHistoryRow = { monthlySalary: bigint; effectiveFrom: Date; effectiveTo: Date | null };

/**
 * Life-to-date accrued cost of a single SalaryHistory period = monthly_salary
 * × số tháng hiệu lực của riêng giai đoạn đó (đã xác nhận với user
 * 2026-08-17, vì Salary là một rate chứ không phải transaction — xem
 * CLAUDE.md). The currently-active period (effectiveTo = null) accrues
 * through the current month inclusive. Exported (2026-08-18) so
 * `dashboard.service.ts` can attribute each period's accrued cost to its own
 * `paidByAdminId` for the by-Admin spending breakdown, instead of only
 * summing per-employee like `accruedSalaryCost` below.
 */
export function accruedRowCost(row: SalaryHistoryRow): bigint {
  const now = new Date();
  const months = row.effectiveTo
    ? Math.max(0, wholeMonthsBetween(row.effectiveFrom, row.effectiveTo))
    : Math.max(1, wholeMonthsBetween(row.effectiveFrom, now) + 1);
  return row.monthlySalary * BigInt(months);
}

/**
 * Life-to-date accrued salary cost — Σ `accruedRowCost` qua từng giai đoạn
 * SalaryHistory của một nhân viên. Exported for reuse by
 * `dashboard.service.ts`'s system-wide all-time salary total (same
 * per-employee formula, summed across every employee — user request
 * 2026-08-18 "muốn báo cáo all").
 */
export function accruedSalaryCost(histories: SalaryHistoryRow[]): bigint {
  return histories.reduce((total, row) => total + accruedRowCost(row), 0n);
}

/**
 * Employee Revenue / Employee Cost (spec §10.1–10.2): `Cost = Page Purchase +
 * Ads + Salary + Profit Settlements` (4th component added 2026-08-19 — see
 * `EmployeeFinancials.profitSettlementCost`). With `monthKey` omitted, every
 * component is an all-time sum (Employee Detail Summary semantics); with
 * `monthKey` set, every component is scoped to that single month (Employee
 * List / User Dashboard "kỳ hiện tại" semantics) — settlements are scoped by
 * `createdAt` (no dedicated month field, they're one-off snapshot entries).
 */
export async function getEmployeeFinancials(employeeId: string, monthKey?: string): Promise<EmployeeFinancials> {
  const dateRange = monthKey ? monthDateRange(monthKey) : null;
  const monthStart = monthKey ? parseMonthKey(monthKey) : null;

  const [revenueAgg, adsAgg, purchaseAgg, salaryHistories, settlementAgg] = await Promise.all([
    prisma.revenue.aggregate({
      _sum: { amount: true },
      where: {
        employeeIdSnapshot: employeeId,
        deletedAt: null,
        ...(monthStart ? { revenueMonth: monthStart } : {}),
      },
    }),
    prisma.adExpense.aggregate({
      _sum: { amount: true },
      where: {
        employeeIdSnapshot: employeeId,
        deletedAt: null,
        ...(monthStart ? { expenseMonth: monthStart } : {}),
      },
    }),
    prisma.pagePurchaseExpense.aggregate({
      _sum: { amount: true },
      where: {
        employeeIdSnapshot: employeeId,
        deletedAt: null,
        ...(monthStart ? { purchaseMonth: monthStart } : {}),
      },
    }),
    prisma.salaryHistory.findMany({
      where: { employeeId },
      select: { monthlySalary: true, effectiveFrom: true, effectiveTo: true },
      orderBy: { effectiveFrom: "asc" },
    }),
    prisma.employeeProfitSettlement.aggregate({
      _sum: { amount: true },
      where: {
        employeeId,
        deletedAt: null,
        ...(dateRange ? { createdAt: { gte: dateRange.gte, lt: dateRange.lt } } : {}),
      },
    }),
  ]);

  const revenue = revenueAgg._sum.amount ?? 0n;
  const adsCost = adsAgg._sum.amount ?? 0n;
  const pagePurchaseCost = purchaseAgg._sum.amount ?? 0n;
  const salaryCost = dateRange ? salaryForMonth(salaryHistories, dateRange) : accruedSalaryCost(salaryHistories);
  const profitSettlementCost = settlementAgg._sum.amount ?? 0n;

  return {
    revenue,
    adsCost,
    pagePurchaseCost,
    salaryCost,
    profitSettlementCost,
    totalCost: adsCost + pagePurchaseCost + salaryCost + profitSettlementCost,
  };
}

export type EmployeeMonthlyDatum = {
  month: string;
  revenue: bigint;
  adsCost: bigint;
  totalCost: bigint;
};

/** Trailing `monthsBack` months (inclusive of the current month) of Revenue/Ads/Total Cost — for Employee Detail & User Dashboard Monthly Chart (spec §14.3/§12). */
export async function getEmployeeMonthlySeries(employeeId: string, monthsBack = 6): Promise<EmployeeMonthlyDatum[]> {
  const latest = currentMonthKey();
  const monthKeys = Array.from({ length: monthsBack }, (_, i) => shiftMonthKey(latest, i - (monthsBack - 1)));

  const results = await Promise.all(monthKeys.map((month) => getEmployeeFinancials(employeeId, month)));
  return monthKeys.map((month, index) => ({
    month,
    revenue: results[index].revenue,
    adsCost: results[index].adsCost,
    totalCost: results[index].totalCost,
  }));
}
