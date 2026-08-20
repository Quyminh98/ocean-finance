import { prisma } from "@/lib/db";
import { logAction } from "@/server/audit/log-action";
import type { Role, UserStatus } from "@/generated/prisma/client";

export class UserAccountError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export type AuditMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export const USER_ACCOUNT_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export type UserAccountPageSize = (typeof USER_ACCOUNT_PAGE_SIZE_OPTIONS)[number];

export type UserAccountListItem = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
};

export type UserAccountListResult = {
  items: UserAccountListItem[];
  total: number;
  page: number;
  pageSize: UserAccountPageSize;
};

export type ListUserAccountsParams = {
  search?: string;
  role?: Role;
  page?: number;
  pageSize?: UserAccountPageSize;
};

/** All accounts (both role=ADMIN and role=USER) — the account-level view, distinct from Employee Management (Phase 3). */
export async function listUserAccounts(params: ListUserAccountsParams): Promise<UserAccountListResult> {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const pageSize =
    params.pageSize && USER_ACCOUNT_PAGE_SIZE_OPTIONS.includes(params.pageSize) ? params.pageSize : 20;
  const search = params.search?.trim();

  const where = {
    ...(params.role ? { role: params.role } : {}),
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
      orderBy: [{ role: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    })),
    total,
    page,
    pageSize,
  };
}

export type AdminOption = { adminId: string; name: string };

/** Every ADMIN-role user — for "Admin đã nhập"/"Người chi" filter and select dropdowns across Ads/Page/Admin Expense. */
export async function listAdminOptions(): Promise<AdminOption[]> {
  const rows = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({ adminId: row.id, name: row.name }));
}

/**
 * Toggles a User account's status (either direction). Guard: an ADMIN cannot be
 * set to INACTIVE if they are the last ACTIVE admin — not in spec/schema.md,
 * added to avoid locking the system out entirely (confirmed with user
 * 2026-08-17, see context/plan.md Phase 13).
 */
export async function setUserAccountStatus(
  userId: string,
  status: UserStatus,
  adminId: string,
  meta: AuditMeta = {},
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UserAccountError("Không tìm thấy tài khoản.", "NOT_FOUND");
  if (user.status === status) return;

  if (status === "INACTIVE" && user.role === "ADMIN") {
    const activeAdminCount = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (activeAdminCount <= 1) {
      throw new UserAccountError(
        "Không thể vô hiệu hoá — đây là Admin đang hoạt động cuối cùng của hệ thống.",
        "LAST_ACTIVE_ADMIN",
      );
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { status } });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: status === "ACTIVE" ? "ACTIVATE" : "DEACTIVATE",
    entityType: "User",
    entityId: userId,
    beforeJson: { status: user.status },
    afterJson: { status },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
