import { prisma } from "@/lib/db";
import { logAction } from "@/server/audit/log-action";
import type { AuditMeta } from "@/server/services/employee.service";
import type { PageStatusColor } from "@/generated/prisma/client";

export class PageStatusOptionError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export type PageStatusOptionListItem = {
  optionId: string;
  label: string;
  color: PageStatusColor;
  createdAt: Date;
};

/** Small fixed-size list (2 seeded + whatever Admin adds) — no pagination (CLAUDE.md "ưu tiên đơn giản"). */
export async function listPageStatusOptions(): Promise<PageStatusOptionListItem[]> {
  const rows = await prisma.pageStatusOption.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((row) => ({ optionId: row.id, label: row.label, color: row.color, createdAt: row.createdAt }));
}

export type PageStatusOptionWithUsage = PageStatusOptionListItem & { pageCount: number };

/** Same list, plus how many Pages currently reference each option — used by the Cài đặt list to warn before Delete. */
export async function listPageStatusOptionsWithUsage(): Promise<PageStatusOptionWithUsage[]> {
  const rows = await prisma.pageStatusOption.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { assignments: { where: { page: { deletedAt: null } } } } } },
  });
  return rows.map((row) => ({
    optionId: row.id,
    label: row.label,
    color: row.color,
    createdAt: row.createdAt,
    pageCount: row._count.assignments,
  }));
}

export type CreatePageStatusOptionInput = { label: string; color: PageStatusColor };
export type CreatePageStatusOptionResult = { optionId: string };

export async function createPageStatusOption(
  input: CreatePageStatusOptionInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<CreatePageStatusOptionResult> {
  const option = await prisma.pageStatusOption.create({ data: { label: input.label, color: input.color } });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: "CREATE",
    entityType: "PageStatusOption",
    entityId: option.id,
    afterJson: { label: input.label, color: input.color },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { optionId: option.id };
}

export type UpdatePageStatusOptionInput = { label: string; color: PageStatusColor };

export async function updatePageStatusOption(
  optionId: string,
  input: UpdatePageStatusOptionInput,
  adminId: string,
  meta: AuditMeta = {},
): Promise<void> {
  const option = await prisma.pageStatusOption.findUnique({ where: { id: optionId } });
  if (!option) throw new PageStatusOptionError("Không tìm thấy loại trạng thái.", "NOT_FOUND");

  const before = { label: option.label, color: option.color };
  await prisma.pageStatusOption.update({ where: { id: optionId }, data: { label: input.label, color: input.color } });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: "UPDATE",
    entityType: "PageStatusOption",
    entityId: optionId,
    beforeJson: before,
    afterJson: { label: input.label, color: input.color },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/**
 * Hard delete (user request 2026-08-18, confirmed via `AskUserQuestion`) —
 * unlike Page/Revenue/AdExpense (financial data, soft delete only), a status
 * option is pure display metadata. Pages currently referencing it fall back
 * to `statusId = null` automatically via the FK's `ON DELETE SET NULL` — no
 * manual cleanup needed here.
 */
export async function deletePageStatusOption(optionId: string, adminId: string, meta: AuditMeta = {}): Promise<void> {
  const option = await prisma.pageStatusOption.findUnique({ where: { id: optionId } });
  if (!option) throw new PageStatusOptionError("Không tìm thấy loại trạng thái.", "NOT_FOUND");

  await prisma.pageStatusOption.delete({ where: { id: optionId } });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: "DELETE",
    entityType: "PageStatusOption",
    entityId: optionId,
    beforeJson: { label: option.label, color: option.color },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
