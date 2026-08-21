import { prisma } from "@/lib/db";
import { logAction } from "@/server/audit/log-action";
import type { AuditMeta } from "@/server/services/employee.service";
import type { Role } from "@/generated/prisma/client";

export class ViaError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export type ViaPageInfo = { pageId: string; name: string };

export type ViaListItem = {
  viaId: string;
  name: string;
  facebookUrl: string;
  holderUserId: string;
  createdAt: Date;
  /** Pages this Via is attached to (user request 2026-08-20 — "1 page ở nhiều via được không") —
   * empty array if none, filtered to non-deleted Pages only. */
  pages: ViaPageInfo[];
};

/** Vias held by one Employee or Admin — self-service list ("Via của tôi") and the read-only
 * tab on Employee/Admin Detail (Admin console). No pagination — small scale per person. */
export async function listViasByHolder(holderUserId: string): Promise<ViaListItem[]> {
  const rows = await prisma.via.findMany({
    where: { holderUserId },
    orderBy: { createdAt: "desc" },
    include: { pageAssignments: { where: { page: { deletedAt: null } }, include: { page: { select: { id: true, name: true } } } } },
  });
  return rows.map((row) => ({
    viaId: row.id,
    name: row.name,
    facebookUrl: row.facebookUrl,
    holderUserId: row.holderUserId,
    createdAt: row.createdAt,
    pages: row.pageAssignments.map((assignment) => ({ pageId: assignment.page.id, name: assignment.page.name })),
  }));
}

export type ViaHolderOption = { userId: string; name: string; role: Role };

/** Every Admin + Employee — for the "Người cầm" filter dropdown on the Admin-only global Via
 * list (user request 2026-08-21). Keyed by `User.id` (not `EmployeeProfile.id`) to match
 * `Via.holderUserId` directly, unlike `listEmployeeOptions()`. */
export async function listViaHolderOptions(): Promise<ViaHolderOption[]> {
  const rows = await prisma.user.findMany({ select: { id: true, name: true, role: true }, orderBy: { name: "asc" } });
  return rows.map((row) => ({ userId: row.id, name: row.name, role: row.role }));
}

export type ViaAdminListItem = ViaListItem & { holder: ViaHolderOption };

export type ListAllViasParams = { holderUserId?: string; search?: string };

/**
 * Every Via in the system, any holder — Admin-only global view (user request 2026-08-21,
 * "via ở phần admin là xem được tất cả via của mọi người kể cả nhân viên"). Filterable by
 * holder + name search, no pagination (small scale). Write actions (create/edit/delete) stay
 * restricted to the holder themselves regardless of who's viewing this list — see
 * `createVia`/`updateVia`/`deleteVia` below, unchanged.
 */
export async function listAllVias(params: ListAllViasParams = {}): Promise<ViaAdminListItem[]> {
  const search = params.search?.trim();
  const rows = await prisma.via.findMany({
    where: {
      ...(params.holderUserId ? { holderUserId: params.holderUserId } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      holder: { select: { id: true, name: true, role: true } },
      pageAssignments: { where: { page: { deletedAt: null } }, include: { page: { select: { id: true, name: true } } } },
    },
  });
  return rows.map((row) => ({
    viaId: row.id,
    name: row.name,
    facebookUrl: row.facebookUrl,
    holderUserId: row.holderUserId,
    createdAt: row.createdAt,
    pages: row.pageAssignments.map((assignment) => ({ pageId: assignment.page.id, name: assignment.page.name })),
    holder: { userId: row.holder.id, name: row.holder.name, role: row.holder.role },
  }));
}

async function assertPageIdsValid(pageIds: string[]): Promise<void> {
  if (pageIds.length === 0) return;
  const count = await prisma.page.count({ where: { id: { in: pageIds }, deletedAt: null } });
  if (count !== pageIds.length) throw new ViaError("Page không hợp lệ.", "INVALID_PAGE");
}

export type CreateViaInput = { name: string; facebookUrl: string; pageIds?: string[] };
export type CreateViaResult = { viaId: string };

/** `holderUserId` is always the caller's own session id (user request 2026-08-20 —
 * "ai tạo là người đó cầm") — never a client-supplied value, no picker. */
export async function createVia(input: CreateViaInput, holderUserId: string, meta: AuditMeta = {}): Promise<CreateViaResult> {
  const pageIds = [...new Set(input.pageIds ?? [])];
  await assertPageIdsValid(pageIds);

  const via = await prisma.$transaction(async (tx) => {
    const via = await tx.via.create({ data: { name: input.name, facebookUrl: input.facebookUrl, holderUserId } });
    if (pageIds.length > 0) {
      await tx.pageViaAssignment.createMany({ data: pageIds.map((pageId) => ({ pageId, viaId: via.id })) });
    }
    return via;
  });

  await logAction({
    actorType: "USER",
    actorUserId: holderUserId,
    action: "CREATE",
    entityType: "Via",
    entityId: via.id,
    afterJson: { name: input.name, facebookUrl: input.facebookUrl, holderUserId, pageIds },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { viaId: via.id };
}

export type UpdateViaInput = { name: string; facebookUrl: string; pageIds?: string[] };

/** Restricted to the holder themselves — same ownership rule as `deleteVia`. `pageIds` fully
 * replaces the Via's current set of attached Pages ("xoá hết rồi tạo lại", same pattern as
 * Page.statusIds in `page.service.ts` — simpler than diffing at this scale). */
export async function updateVia(viaId: string, input: UpdateViaInput, actingUserId: string, meta: AuditMeta = {}): Promise<void> {
  const via = await prisma.via.findUnique({ where: { id: viaId } });
  if (!via) throw new ViaError("Không tìm thấy via.", "NOT_FOUND");
  if (via.holderUserId !== actingUserId) throw new ViaError("Bạn không có quyền sửa via này.", "FORBIDDEN");

  const pageIds = [...new Set(input.pageIds ?? [])];
  await assertPageIdsValid(pageIds);

  const before = { name: via.name, facebookUrl: via.facebookUrl };

  await prisma.$transaction(async (tx) => {
    await tx.via.update({ where: { id: viaId }, data: { name: input.name, facebookUrl: input.facebookUrl } });
    await tx.pageViaAssignment.deleteMany({ where: { viaId } });
    if (pageIds.length > 0) {
      await tx.pageViaAssignment.createMany({ data: pageIds.map((pageId) => ({ pageId, viaId })) });
    }
  });

  await logAction({
    actorType: "USER",
    actorUserId: actingUserId,
    action: "UPDATE",
    entityType: "Via",
    entityId: viaId,
    beforeJson: before,
    afterJson: { name: input.name, facebookUrl: input.facebookUrl, pageIds },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/**
 * Hard delete — same reasoning as Seller/PageStatusOption (pure account
 * metadata, not financial data). Restricted to the holder themselves — only
 * the person who created (and therefore holds) a Via can delete it, same
 * ownership rule as creation. PageViaAssignment rows for this Via disappear
 * automatically via `ON DELETE CASCADE` — the attached Pages themselves are
 * untouched.
 */
export async function deleteVia(viaId: string, actingUserId: string, meta: AuditMeta = {}): Promise<void> {
  const via = await prisma.via.findUnique({ where: { id: viaId } });
  if (!via) throw new ViaError("Không tìm thấy via.", "NOT_FOUND");
  if (via.holderUserId !== actingUserId) throw new ViaError("Bạn không có quyền xoá via này.", "FORBIDDEN");

  await prisma.via.delete({ where: { id: viaId } });

  await logAction({
    actorType: "USER",
    actorUserId: actingUserId,
    action: "DELETE",
    entityType: "Via",
    entityId: viaId,
    beforeJson: { name: via.name, facebookUrl: via.facebookUrl, holderUserId: via.holderUserId },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
