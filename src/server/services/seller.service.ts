import { prisma } from "@/lib/db";
import { logAction } from "@/server/audit/log-action";
import type { AuditMeta } from "@/server/services/employee.service";

export class SellerError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export type SellerListItem = { sellerId: string; name: string; createdAt: Date };

/** Small managed list (Admin-added) — no pagination (CLAUDE.md "ưu tiên đơn giản"). */
export async function listSellers(): Promise<SellerListItem[]> {
  const rows = await prisma.seller.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((row) => ({ sellerId: row.id, name: row.name, createdAt: row.createdAt }));
}

export type SellerWithUsage = SellerListItem & { pageCount: number };

/** Same list, plus how many (non-deleted) Pages currently reference each seller — used by the Cài đặt list to warn before Delete. */
export async function listSellersWithUsage(): Promise<SellerWithUsage[]> {
  const rows = await prisma.seller.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { pages: { where: { deletedAt: null } } } } },
  });
  return rows.map((row) => ({ sellerId: row.id, name: row.name, createdAt: row.createdAt, pageCount: row._count.pages }));
}

export type CreateSellerInput = { name: string };
export type CreateSellerResult = { sellerId: string };

export async function createSeller(input: CreateSellerInput, adminId: string, meta: AuditMeta = {}): Promise<CreateSellerResult> {
  const seller = await prisma.seller.create({ data: { name: input.name } });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: "CREATE",
    entityType: "Seller",
    entityId: seller.id,
    afterJson: { name: input.name },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { sellerId: seller.id };
}

export type UpdateSellerInput = { name: string };

export async function updateSeller(sellerId: string, input: UpdateSellerInput, adminId: string, meta: AuditMeta = {}): Promise<void> {
  const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
  if (!seller) throw new SellerError("Không tìm thấy người bán.", "NOT_FOUND");

  const before = { name: seller.name };
  await prisma.seller.update({ where: { id: sellerId }, data: { name: input.name } });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: "UPDATE",
    entityType: "Seller",
    entityId: sellerId,
    beforeJson: before,
    afterJson: { name: input.name },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/**
 * Hard delete — same reasoning as `deletePageStatusOption` (pure display/
 * reference metadata, not financial data). Pages currently referencing this
 * seller fall back to `sellerId = null` automatically via the FK's
 * `ON DELETE SET NULL` — no manual cleanup needed here.
 */
export async function deleteSeller(sellerId: string, adminId: string, meta: AuditMeta = {}): Promise<void> {
  const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
  if (!seller) throw new SellerError("Không tìm thấy người bán.", "NOT_FOUND");

  await prisma.seller.delete({ where: { id: sellerId } });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: "DELETE",
    entityType: "Seller",
    entityId: sellerId,
    beforeJson: { name: seller.name },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
