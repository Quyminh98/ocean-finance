import { prisma } from "@/lib/db";
import { logAction } from "@/server/audit/log-action";
import type { AuditMeta } from "@/server/services/employee.service";
import type { PayoutStatus } from "@/generated/prisma/client";

export class PayoutError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export type PayoutListItem = {
  payoutId: string;
  name: string;
  bankName: string;
  status: PayoutStatus;
  note: string | null;
  createdAt: Date;
};

/** Small managed list (Admin-added) — no pagination (CLAUDE.md "ưu tiên đơn giản"). */
export async function listPayouts(): Promise<PayoutListItem[]> {
  const rows = await prisma.payout.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((row) => ({
    payoutId: row.id,
    name: row.name,
    bankName: row.bankName,
    status: row.status,
    note: row.note,
    createdAt: row.createdAt,
  }));
}

export type PayoutWithUsage = PayoutListItem & { pageCount: number };

/** Same list, plus how many (non-deleted) Pages currently reference each payout — used by the Cài đặt list to warn before Delete. */
export async function listPayoutsWithUsage(): Promise<PayoutWithUsage[]> {
  const rows = await prisma.payout.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { pages: { where: { deletedAt: null } } } } },
  });
  return rows.map((row) => ({
    payoutId: row.id,
    name: row.name,
    bankName: row.bankName,
    status: row.status,
    note: row.note,
    createdAt: row.createdAt,
    pageCount: row._count.pages,
  }));
}

export type CreatePayoutInput = { name: string; bankName: string; status: PayoutStatus; note?: string };
export type CreatePayoutResult = { payoutId: string };

export async function createPayout(input: CreatePayoutInput, adminId: string, meta: AuditMeta = {}): Promise<CreatePayoutResult> {
  const payout = await prisma.payout.create({
    data: { name: input.name, bankName: input.bankName, status: input.status, note: input.note },
  });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: "CREATE",
    entityType: "Payout",
    entityId: payout.id,
    afterJson: { name: input.name, bankName: input.bankName, status: input.status, note: input.note ?? null },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { payoutId: payout.id };
}

export type UpdatePayoutInput = { name: string; bankName: string; status: PayoutStatus; note?: string };

export async function updatePayout(payoutId: string, input: UpdatePayoutInput, adminId: string, meta: AuditMeta = {}): Promise<void> {
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!payout) throw new PayoutError("Không tìm thấy payout.", "NOT_FOUND");

  const before = { name: payout.name, bankName: payout.bankName, status: payout.status, note: payout.note };
  await prisma.payout.update({
    where: { id: payoutId },
    data: { name: input.name, bankName: input.bankName, status: input.status, note: input.note ?? null },
  });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: "UPDATE",
    entityType: "Payout",
    entityId: payoutId,
    beforeJson: before,
    afterJson: { name: input.name, bankName: input.bankName, status: input.status, note: input.note ?? null },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/**
 * Hard delete — same reasoning as Seller/PageStatusOption (pure
 * reference/status metadata, not financial data). Pages currently
 * referencing it fall back to `payoutId = null` automatically via the FK's
 * `ON DELETE SET NULL` — no manual cleanup needed here.
 */
export async function deletePayout(payoutId: string, adminId: string, meta: AuditMeta = {}): Promise<void> {
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!payout) throw new PayoutError("Không tìm thấy payout.", "NOT_FOUND");

  await prisma.payout.delete({ where: { id: payoutId } });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: "DELETE",
    entityType: "Payout",
    entityId: payoutId,
    beforeJson: { name: payout.name, bankName: payout.bankName, status: payout.status, note: payout.note },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
