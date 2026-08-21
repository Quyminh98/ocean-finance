import { prisma } from "@/lib/db";
import { logAction, auditActorFields } from "@/server/audit/log-action";
import type { AuditMeta } from "@/server/services/employee.service";
import type { PageStatusColor, PageType, PayoutStatus } from "@/generated/prisma/client";
import { currentMonthKey } from "@/lib/dates";
import { parseMonthKey } from "@/lib/month";

export class PageError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

/** Shared mapper for the `payout` relation, used by listPages/listPagesByEmployee/getPageDetail. */
function toPagePayoutInfo(
  payout: { id: string; name: string; bankName: string; status: PayoutStatus } | null,
): PagePayoutInfo | null {
  return payout ? { payoutId: payout.id, name: payout.name, bankName: payout.bankName, status: payout.status } : null;
}

export const PAGES_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export type PagesPageSize = (typeof PAGES_PAGE_SIZE_OPTIONS)[number];

export type PageStatusInfo = { statusId: string; label: string; color: PageStatusColor };
/** `name` ("Tên payout") is the identifying label everywhere this is displayed — `bankName`
 * stays as secondary bank account detail (user request 2026-08-21). */
export type PagePayoutInfo = { payoutId: string; name: string; bankName: string; status: PayoutStatus };

export type PageListItem = {
  pageId: string;
  name: string;
  facebookUrl: string;
  pageType: PageType;
  currentEmployeeId: string | null;
  currentEmployeeName: string | null;
  purchasePrice: bigint;
  purchaseMonth: Date;
  /** Empty array = "chưa đặt" (never assigned, or every assigned option was since deleted). */
  currentStatuses: PageStatusInfo[];
  /** null = no Payout picked yet, or the picked one was since deleted (user request 2026-08-20). */
  payout: PagePayoutInfo | null;
  notes: string | null;
  createdAt: Date;
};

export type PageListResult = {
  items: PageListItem[];
  total: number;
  page: number;
  pageSize: PagesPageSize;
};

export type ListPagesParams = {
  search?: string;
  pageType?: PageType;
  /** FK → PageStatusOption — matches any Page currently carrying this tag (a Page can carry several at once). */
  statusId?: string;
  /** Current owner — matches the same active (endedAt=null) PageAssignment used for `currentEmployeeName` below. */
  employeeId?: string;
  page?: number;
  pageSize?: PagesPageSize;
};

/** Current owner is read from the active (endedAt=null) PageAssignment — the
 * same source of truth `resolvePageOwner` uses, just for "now" instead of an
 * arbitrary date, so a plain findMany is enough (no need for the full
 * as-of-date algorithm here). */
export async function listPages(params: ListPagesParams): Promise<PageListResult> {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const pageSize = params.pageSize && PAGES_PAGE_SIZE_OPTIONS.includes(params.pageSize) ? params.pageSize : 20;
  const search = params.search?.trim();

  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { facebookUrl: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(params.pageType ? { pageType: params.pageType } : {}),
    ...(params.statusId ? { statusAssignments: { some: { statusOptionId: params.statusId } } } : {}),
    ...(params.employeeId ? { assignments: { some: { employeeId: params.employeeId, endedAt: null } } } : {}),
  };

  const [total, pages] = await Promise.all([
    prisma.page.count({ where }),
    prisma.page.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        assignments: { where: { endedAt: null }, take: 1, include: { employee: { include: { user: true } } } },
        statusAssignments: { include: { statusOption: true }, orderBy: { createdAt: "asc" } },
        payout: { select: { id: true, name: true, bankName: true, status: true } },
      },
    }),
  ]);

  const items: PageListItem[] = pages.map((row) => ({
    pageId: row.id,
    name: row.name,
    facebookUrl: row.facebookUrl,
    pageType: row.pageType,
    currentEmployeeId: row.assignments[0]?.employeeId ?? null,
    currentEmployeeName: row.assignments[0]?.employee.user.name ?? null,
    purchasePrice: row.purchasePrice,
    purchaseMonth: row.purchaseMonth,
    currentStatuses: row.statusAssignments.map((assignment) => ({
      statusId: assignment.statusOption.id,
      label: assignment.statusOption.label,
      color: assignment.statusOption.color,
    })),
    payout: toPagePayoutInfo(row.payout),
    notes: row.notes,
    createdAt: row.createdAt,
  }));

  return { items, total, page, pageSize };
}

export type ListPagesByEmployeeParams = {
  search?: string;
  pageType?: PageType;
  /** FK → PageStatusOption — matches any Page currently carrying this tag. */
  statusId?: string;
};

/**
 * Pages the given employee CURRENTLY manages — `/user/pages` (spec §12, user
 * request 2026-08-18 "hiển thị table page như trang admin"), mirroring
 * `listPages`' shape/columns but scoped to one employee's active assignment
 * and dropping the redundant `currentEmployeeName` field (always this
 * employee). No pagination — same small-scale-per-employee tradeoff as
 * `getDashboardEmployeeRows`. Employee-scoped, not history — past
 * assignments were intentionally dropped from this view (confirmed with
 * user), unlike `getEmployeeAssignmentHistory` which this route used before.
 * `search`/`pageType`/`statusId` mirror `listPages()` (user request
 * 2026-08-18 "cũng có filter như thế") — no `employeeId` filter here, it's
 * always implicitly this one employee.
 */
export async function listPagesByEmployee(employeeId: string, params: ListPagesByEmployeeParams = {}): Promise<PageListItem[]> {
  const search = params.search?.trim();
  const pages = await prisma.page.findMany({
    where: {
      deletedAt: null,
      assignments: { some: { employeeId, endedAt: null } },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { facebookUrl: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(params.pageType ? { pageType: params.pageType } : {}),
      ...(params.statusId ? { statusAssignments: { some: { statusOptionId: params.statusId } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      assignments: { where: { endedAt: null }, take: 1, include: { employee: { include: { user: true } } } },
      statusAssignments: { include: { statusOption: true }, orderBy: { createdAt: "asc" } },
      payout: { select: { id: true, name: true, bankName: true, status: true } },
    },
  });

  return pages.map((row) => ({
    pageId: row.id,
    name: row.name,
    facebookUrl: row.facebookUrl,
    pageType: row.pageType,
    currentEmployeeId: row.assignments[0]?.employeeId ?? null,
    currentEmployeeName: row.assignments[0]?.employee.user.name ?? null,
    purchasePrice: row.purchasePrice,
    purchaseMonth: row.purchaseMonth,
    currentStatuses: row.statusAssignments.map((assignment) => ({
      statusId: assignment.statusOption.id,
      label: assignment.statusOption.label,
      color: assignment.statusOption.color,
    })),
    payout: toPagePayoutInfo(row.payout),
    notes: row.notes,
    createdAt: row.createdAt,
  }));
}

export type PageOption = { pageId: string; name: string };

/** Non-deleted Pages — for filter/select dropdowns (Revenue/Ads Create + Filter). */
export async function listPageOptions(): Promise<PageOption[]> {
  const pages = await prisma.page.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return pages.map((row) => ({ pageId: row.id, name: row.name }));
}

export type PageDetail = {
  pageId: string;
  name: string;
  facebookUrl: string;
  pageType: PageType;
  purchasePrice: bigint;
  purchaseMonth: Date;
  /** Empty array = "chưa đặt" (never assigned, or every assigned option was since deleted). */
  currentStatuses: PageStatusInfo[];
  notes: string | null;
  createdAt: Date;
  currentEmployee: { employeeId: string; name: string } | null;
  /** Who paid (or is designated to pay) for the purchase — null when purchasePrice=0. Sourced from the
   * PagePurchaseExpense once it exists, falling back to the Page's own paidByAdminId before that (deferred case). */
  purchasePaidByAdminName: string | null;
  /** Người bán — null for pageType=SYSTEM or when no Seller was picked at creation (user request 2026-08-20). */
  sellerName: string | null;
  /** Payout/bank account — null when none picked, or the picked one was since deleted (user request 2026-08-20). */
  payout: PagePayoutInfo | null;
};

export async function getPageDetail(pageId: string): Promise<PageDetail | null> {
  const row = await prisma.page.findUnique({
    where: { id: pageId },
    include: {
      assignments: { where: { endedAt: null }, take: 1, include: { employee: { include: { user: true } } } },
      purchaseExpense: { select: { paidByAdmin: { select: { name: true } } } },
      paidByAdmin: { select: { name: true } },
      seller: { select: { name: true } },
      payout: { select: { id: true, name: true, bankName: true, status: true } },
      statusAssignments: { include: { statusOption: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!row || row.deletedAt) return null;

  const activeAssignment = row.assignments[0];
  return {
    pageId: row.id,
    name: row.name,
    facebookUrl: row.facebookUrl,
    pageType: row.pageType,
    purchasePrice: row.purchasePrice,
    purchaseMonth: row.purchaseMonth,
    currentStatuses: row.statusAssignments.map((assignment) => ({
      statusId: assignment.statusOption.id,
      label: assignment.statusOption.label,
      color: assignment.statusOption.color,
    })),
    notes: row.notes,
    createdAt: row.createdAt,
    currentEmployee: activeAssignment
      ? { employeeId: activeAssignment.employeeId, name: activeAssignment.employee.user.name }
      : null,
    purchasePaidByAdminName: row.purchaseExpense?.paidByAdmin.name ?? row.paidByAdmin?.name ?? null,
    sellerName: row.seller?.name ?? null,
    payout: toPagePayoutInfo(row.payout),
  };
}

export type CreatePageInput = {
  name: string;
  facebookUrl: string;
  /** SYSTEM = no purchase price (purchasePrice must be 0, no payer). BKT = existing paid flow.
   * Optional, defaults to "BKT" at the service layer — same reasoning as `statusColor` before
   * it (schema.md Changelog "Page.status đổi từ enum..."): dozens of existing tests call
   * `createPage()` directly and predate this field, not worth rewriting all of them for it. */
  pageType?: PageType;
  purchasePrice: bigint;
  purchaseMonth: Date;
  /** Optional (user request) — an unassigned Page can be assigned later via `assignEmployee`. */
  assignEmployeeId?: string;
  /** Required whenever purchasePrice > 0, regardless of assignEmployeeId — captured now so
   * `assignEmployee()` can reuse it later without asking again (user request 2026-08-18). */
  paidByAdminId?: string;
  /** FK → Seller — người bán, only persisted for pageType=BKT (dropped silently for SYSTEM,
   * same treatment as purchasePrice/paidByAdminId — user request 2026-08-20). */
  sellerId?: string;
  /** FK → Payout — payout/bank account, no pageType restriction (user request 2026-08-20). */
  payoutId?: string;
  /** FKs → PageStatusOption, a Page can carry several at once (user request 2026-08-18). Omitted/empty
   * leaves the Page with zero statuses ("chưa đặt"), same end state as when every assigned option gets
   * deleted later. */
  statusIds?: string[];
  notes?: string;
};

export type CreatePageResult = {
  pageId: string;
};

/**
 * Create Page + (if an employee is assigned up front) the first
 * PageAssignment + (if purchasePrice > 0) the one-time PagePurchaseExpense
 * snapshot, all in a single transaction — spec §15.2 / §44 "Create Page" /
 * schema.md constraint #6. If no employee is assigned at creation, the Page
 * is created bare (no assignment, no purchase expense yet) — both are
 * created together later, whenever `assignEmployee` first runs, reusing the
 * `paidByAdminId` captured here.
 */
export async function createPage(
  input: CreatePageInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<CreatePageResult> {
  const employee = input.assignEmployeeId
    ? await prisma.employeeProfile.findUnique({ where: { id: input.assignEmployeeId }, include: { user: true } })
    : null;
  if (input.assignEmployeeId) {
    if (!employee) throw new PageError("Không tìm thấy nhân viên.", "NOT_FOUND");
    if (employee.user.status !== "ACTIVE") {
      throw new PageError("Nhân viên được gán phải đang ở trạng thái hoạt động.", "EMPLOYEE_INACTIVE");
    }
  }

  const pageType = input.pageType ?? "BKT";
  if (pageType === "SYSTEM" && input.purchasePrice > 0n) {
    throw new PageError("Page hệ thống không có giá mua.", "SYSTEM_PAGE_NO_PRICE");
  }
  const needsPayer = pageType === "BKT" && input.purchasePrice > 0n;
  if (needsPayer) {
    if (!input.paidByAdminId) throw new PageError("Vui lòng chọn người chi khi có giá mua Page.", "MISSING_PAYER");
    const payer = await prisma.user.findUnique({ where: { id: input.paidByAdminId } });
    if (!payer || payer.role !== "ADMIN") throw new PageError("Người chi không hợp lệ.", "INVALID_PAYER");
  }
  if (input.sellerId) {
    const seller = await prisma.seller.findUnique({ where: { id: input.sellerId } });
    if (!seller) throw new PageError("Người bán không hợp lệ.", "INVALID_SELLER");
  }
  const sellerId = pageType === "BKT" ? input.sellerId : undefined;
  if (input.payoutId) {
    const payout = await prisma.payout.findUnique({ where: { id: input.payoutId } });
    if (!payout) throw new PageError("Payout không hợp lệ.", "INVALID_PAYOUT");
  }
  const statusIds = [...new Set(input.statusIds ?? [])];
  if (statusIds.length > 0) {
    const count = await prisma.pageStatusOption.count({ where: { id: { in: statusIds } } });
    if (count !== statusIds.length) throw new PageError("Trạng thái không hợp lệ.", "INVALID_STATUS");
  }
  const willCreatePurchaseExpense = Boolean(input.assignEmployeeId) && needsPayer;

  const { page, assignment, purchaseExpense } = await prisma.$transaction(async (tx) => {
    const page = await tx.page.create({
      data: {
        name: input.name,
        facebookUrl: input.facebookUrl,
        pageType,
        purchasePrice: input.purchasePrice,
        purchaseMonth: input.purchaseMonth,
        paidByAdminId: needsPayer ? input.paidByAdminId : undefined,
        sellerId,
        payoutId: input.payoutId,
        notes: input.notes,
        createdByAdminId: adminId,
      },
    });

    if (statusIds.length > 0) {
      await tx.pageStatusAssignment.createMany({
        data: statusIds.map((statusOptionId) => ({ pageId: page.id, statusOptionId })),
      });
    }

    if (!input.assignEmployeeId) return { page, assignment: null, purchaseExpense: null };

    const assignment = await tx.pageAssignment.create({
      data: {
        pageId: page.id,
        employeeId: input.assignEmployeeId,
        startedAt: input.purchaseMonth,
        assignedByAdminId: adminId,
      },
    });

    const purchaseExpense = willCreatePurchaseExpense
      ? await tx.pagePurchaseExpense.create({
          data: {
            pageId: page.id,
            employeeIdSnapshot: input.assignEmployeeId!,
            assignmentIdSnapshot: assignment.id,
            purchaseMonth: input.purchaseMonth,
            amount: input.purchasePrice,
            createdByAdminId: adminId,
            paidByAdminId: input.paidByAdminId!,
          },
        })
      : null;

    return { page, assignment, purchaseExpense };
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "CREATE",
    entityType: "Page",
    entityId: page.id,
    afterJson: {
      name: input.name,
      facebookUrl: input.facebookUrl,
      pageType,
      purchasePrice: input.purchasePrice.toString(),
      purchaseMonth: input.purchaseMonth.toISOString().slice(0, 7),
      statusIds,
      assignEmployeeId: input.assignEmployeeId ?? null,
      assignmentId: assignment?.id ?? null,
      purchaseExpenseId: purchaseExpense?.id ?? null,
      paidByAdminId: needsPayer ? input.paidByAdminId : null,
      sellerId: sellerId ?? null,
      payoutId: input.payoutId ?? null,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { pageId: page.id };
}

export type CreateSystemPageForSelfInput = {
  name: string;
  facebookUrl: string;
  /** FK → Payout (user request 2026-08-20 — "áp dụng chọn payout cho page cả ở admin và nhân viên"). */
  payoutId?: string;
  statusIds?: string[];
  notes?: string;
};

/**
 * User self-service counterpart of `createPage()` — a User adds a Page hệ
 * thống to their own account directly, no Admin step (user request
 * 2026-08-18). Locked to `pageType=SYSTEM`: purchasePrice is always 0, no
 * payer, no PagePurchaseExpense ever — and the caller is immediately their
 * own PageAssignment (started this month), skipping the "chưa gán" state
 * `createPage()` allows. `userId`/`employeeId` are both the caller's own,
 * resolved from the session by the caller (never trusted from a client
 * param) — reused as `createdByAdminId`/`assignedByAdminId` since those
 * fields are plain FK→User in schema.md, not role-restricted to ADMIN.
 */
export async function createSystemPageForSelf(
  input: CreateSystemPageForSelfInput,
  employeeId: string,
  userId: string,
  meta: AuditMeta = {},
): Promise<CreatePageResult> {
  const statusIds = [...new Set(input.statusIds ?? [])];
  if (statusIds.length > 0) {
    const count = await prisma.pageStatusOption.count({ where: { id: { in: statusIds } } });
    if (count !== statusIds.length) throw new PageError("Trạng thái không hợp lệ.", "INVALID_STATUS");
  }
  if (input.payoutId) {
    const payout = await prisma.payout.findUnique({ where: { id: input.payoutId } });
    if (!payout) throw new PageError("Payout không hợp lệ.", "INVALID_PAYOUT");
  }
  const monthStart = parseMonthKey(currentMonthKey())!;

  const { page, assignment } = await prisma.$transaction(async (tx) => {
    const page = await tx.page.create({
      data: {
        name: input.name,
        facebookUrl: input.facebookUrl,
        pageType: "SYSTEM",
        purchasePrice: 0n,
        purchaseMonth: monthStart,
        payoutId: input.payoutId,
        notes: input.notes,
        createdByAdminId: userId,
      },
    });

    if (statusIds.length > 0) {
      await tx.pageStatusAssignment.createMany({
        data: statusIds.map((statusOptionId) => ({ pageId: page.id, statusOptionId })),
      });
    }

    const assignment = await tx.pageAssignment.create({
      data: {
        pageId: page.id,
        employeeId,
        startedAt: monthStart,
        assignedByAdminId: userId,
      },
    });

    return { page, assignment };
  });

  await logAction({
    actorType: "USER",
    actorUserId: userId,
    action: "CREATE",
    entityType: "Page",
    entityId: page.id,
    afterJson: {
      name: input.name,
      facebookUrl: input.facebookUrl,
      pageType: "SYSTEM",
      purchaseMonth: monthStart.toISOString().slice(0, 7),
      payoutId: input.payoutId ?? null,
      statusIds,
      assignmentId: assignment.id,
      selfService: true,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { pageId: page.id };
}

export type UpdatePageInput = {
  name: string;
  facebookUrl: string;
  /** FKs → PageStatusOption — replaces the Page's full set of status tags (user request 2026-08-18). */
  statusIds?: string[];
  /** FK → Payout — unlike sellerId, editable after creation (user request 2026-08-20). `undefined`/omitted
   * clears it (full-replace semantics, same as `notes`), not "leave unchanged". */
  payoutId?: string;
  notes?: string;
};

/** Edit Page — name/URL/status/payout/notes (spec §15.3, payout added 2026-08-20). Employee changes go through `transferPage`. */
export async function updatePage(
  pageId: string,
  input: UpdatePageInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<void> {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { statusAssignments: { select: { statusOptionId: true } } },
  });
  if (!page || page.deletedAt) throw new PageError("Không tìm thấy Page.", "NOT_FOUND");

  const statusIds = [...new Set(input.statusIds ?? [])];
  if (statusIds.length > 0) {
    const count = await prisma.pageStatusOption.count({ where: { id: { in: statusIds } } });
    if (count !== statusIds.length) throw new PageError("Trạng thái không hợp lệ.", "INVALID_STATUS");
  }
  if (input.payoutId) {
    const payout = await prisma.payout.findUnique({ where: { id: input.payoutId } });
    if (!payout) throw new PageError("Payout không hợp lệ.", "INVALID_PAYOUT");
  }

  const before = {
    name: page.name,
    facebookUrl: page.facebookUrl,
    statusIds: page.statusAssignments.map((assignment) => assignment.statusOptionId),
    payoutId: page.payoutId,
    notes: page.notes,
  };

  await prisma.$transaction(async (tx) => {
    await tx.page.update({
      where: { id: pageId },
      data: { name: input.name, facebookUrl: input.facebookUrl, payoutId: input.payoutId ?? null, notes: input.notes ?? null },
    });
    await tx.pageStatusAssignment.deleteMany({ where: { pageId } });
    if (statusIds.length > 0) {
      await tx.pageStatusAssignment.createMany({
        data: statusIds.map((statusOptionId) => ({ pageId, statusOptionId })),
      });
    }
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "UPDATE",
    entityType: "Page",
    entityId: pageId,
    beforeJson: before,
    afterJson: {
      name: input.name,
      facebookUrl: input.facebookUrl,
      statusIds,
      payoutId: input.payoutId ?? null,
      notes: input.notes ?? null,
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export type UpdatePageStatusInput = {
  statusIds?: string[];
  /** FK → Payout — Employee self-service (user request 2026-08-20, "áp dụng chọn payout cho
   * page cả ở admin và nhân viên"). Same full-replace/clear semantics as `updatePage`. */
  payoutId?: string;
};

/**
 * Employee-scoped status update — User role can only change the status tags
 * of a Page they CURRENTLY manage, nothing else (name/URL/notes stay
 * Admin-only via `updatePage`) — spec §12, user request 2026-08-18 "chỉ có
 * thể edit được trạng thái thôi". `employeeId` must come from the caller's
 * own session (`requireUser()` + `getEmployeeDetailByUserId`), never a
 * client-supplied value — the active-assignment check below is the RBAC
 * boundary that keeps a User from editing a Page they don't manage.
 */
export async function updatePageStatusByEmployee(
  pageId: string,
  employeeId: string,
  input: UpdatePageStatusInput,
  actorUserId: string,
  meta: AuditMeta = {},
): Promise<void> {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { statusAssignments: { select: { statusOptionId: true } } },
  });
  if (!page || page.deletedAt) throw new PageError("Không tìm thấy Page.", "NOT_FOUND");

  const activeAssignment = await prisma.pageAssignment.findFirst({
    where: { pageId, employeeId, endedAt: null },
  });
  if (!activeAssignment) throw new PageError("Bạn không phụ trách Page này.", "FORBIDDEN");

  const statusIds = [...new Set(input.statusIds ?? [])];
  if (statusIds.length > 0) {
    const count = await prisma.pageStatusOption.count({ where: { id: { in: statusIds } } });
    if (count !== statusIds.length) throw new PageError("Trạng thái không hợp lệ.", "INVALID_STATUS");
  }
  if (input.payoutId) {
    const payout = await prisma.payout.findUnique({ where: { id: input.payoutId } });
    if (!payout) throw new PageError("Payout không hợp lệ.", "INVALID_PAYOUT");
  }

  const before = { statusIds: page.statusAssignments.map((assignment) => assignment.statusOptionId), payoutId: page.payoutId };

  await prisma.$transaction(async (tx) => {
    await tx.page.update({ where: { id: pageId }, data: { payoutId: input.payoutId ?? null } });
    await tx.pageStatusAssignment.deleteMany({ where: { pageId } });
    if (statusIds.length > 0) {
      await tx.pageStatusAssignment.createMany({
        data: statusIds.map((statusOptionId) => ({ pageId, statusOptionId })),
      });
    }
  });

  await logAction({
    actorType: "USER",
    actorUserId,
    action: "UPDATE",
    entityType: "Page",
    entityId: pageId,
    beforeJson: before,
    afterJson: { statusIds, payoutId: input.payoutId ?? null },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/**
 * Soft delete — sets `deletedAt`, never removes the row (CLAUDE.md "Soft
 * delete cho dữ liệu tài chính"). Distinct from the Page's status tags
 * (still a visible, editable business state): deleting hides the Page
 * entirely from Admin views while PageAssignment/Revenue/AdExpense/
 * PagePurchaseExpense history tied to it is left untouched (snapshot
 * pattern — nothing cascades).
 */
export async function softDeletePage(pageId: string, adminId: string, meta: AuditMeta = {}): Promise<void> {
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page || page.deletedAt) throw new PageError("Không tìm thấy Page.", "NOT_FOUND");

  await prisma.page.update({ where: { id: pageId }, data: { deletedAt: new Date() } });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "DELETE",
    entityType: "Page",
    entityId: pageId,
    beforeJson: { name: page.name },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export type PagePurchaseExpenseListItem = {
  pageId: string;
  pageName: string;
  purchaseMonth: Date;
  amount: bigint;
  paidByAdminName: string;
};

/**
 * Page Purchase Expense breakdown for one employee (user request 2026-08-18
 * — Employee Detail "Chi phí" tab, same page+month detail shown for Ads).
 * At most one row per Page (schema.md `PagePurchaseExpense.page_id` unique),
 * so this stays small enough to not need pagination.
 */
export async function listPagePurchaseExpensesByEmployee(employeeId: string): Promise<PagePurchaseExpenseListItem[]> {
  const rows = await prisma.pagePurchaseExpense.findMany({
    where: { employeeIdSnapshot: employeeId, deletedAt: null },
    orderBy: { purchaseMonth: "desc" },
    include: { page: { select: { name: true } }, paidByAdmin: { select: { name: true } } },
  });
  return rows.map((row) => ({
    pageId: row.pageId,
    pageName: row.page.name,
    purchaseMonth: row.purchaseMonth,
    amount: row.amount,
    paidByAdminName: row.paidByAdmin.name,
  }));
}

/** Same shape as `listPagePurchaseExpensesByEmployee`, scoped by `paidByAdminId` instead — Admin Detail "Chi tiết đã chi" (user request 2026-08-20). */
export async function listPagePurchaseExpensesByAdmin(adminId: string): Promise<PagePurchaseExpenseListItem[]> {
  const rows = await prisma.pagePurchaseExpense.findMany({
    where: { paidByAdminId: adminId, deletedAt: null },
    orderBy: { purchaseMonth: "desc" },
    include: { page: { select: { name: true } }, paidByAdmin: { select: { name: true } } },
  });
  return rows.map((row) => ({
    pageId: row.pageId,
    pageName: row.page.name,
    purchaseMonth: row.purchaseMonth,
    amount: row.amount,
    paidByAdminName: row.paidByAdmin.name,
  }));
}
