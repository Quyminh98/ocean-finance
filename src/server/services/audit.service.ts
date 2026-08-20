import { prisma } from "@/lib/db";
import type { AuditActorType } from "@/generated/prisma/client";

export const AUDIT_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export type AuditPageSize = (typeof AUDIT_PAGE_SIZE_OPTIONS)[number];

export type AuditLogListItem = {
  id: string;
  actorType: AuditActorType;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: unknown;
  afterJson: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string;
  createdAt: Date;
};

export type AuditLogListResult = {
  items: AuditLogListItem[];
  total: number;
  page: number;
  pageSize: AuditPageSize;
};

export type ListAuditLogsParams = {
  entityType?: string;
  action?: string;
  actorUserId?: string;
  /** Exact match — entity_id is a `@db.Uuid` column, not a free-text field. */
  entityId?: string;
  /** "YYYY-MM-DD", inclusive. */
  dateFrom?: string;
  /** "YYYY-MM-DD", inclusive. */
  dateTo?: string;
  page?: number;
  pageSize?: AuditPageSize;
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses a "YYYY-MM-DD" into a UTC day boundary; `endExclusive` shifts it to the start of the next day for a `lt` upper bound. */
function parseDateBoundary(value: string | undefined, endExclusive: boolean): Date | null {
  if (!value) return null;
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]) + (endExclusive ? 1 : 0);
  return new Date(Date.UTC(year, month, day));
}

/** Read-only search over AuditLog (spec §29, plan Phase 12) — the table itself is append-only, this never writes. */
export async function listAuditLogs(params: ListAuditLogsParams): Promise<AuditLogListResult> {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const pageSize = params.pageSize && AUDIT_PAGE_SIZE_OPTIONS.includes(params.pageSize) ? params.pageSize : 20;

  const dateFrom = parseDateBoundary(params.dateFrom, false);
  const dateToExclusive = parseDateBoundary(params.dateTo, true);

  const where = {
    ...(params.entityType ? { entityType: params.entityType } : {}),
    ...(params.action ? { action: params.action } : {}),
    ...(params.actorUserId ? { actorUserId: params.actorUserId } : {}),
    ...(params.entityId ? { entityId: params.entityId } : {}),
    ...(dateFrom || dateToExclusive
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateToExclusive ? { lt: dateToExclusive } : {}),
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        actorUser: { select: { name: true, email: true } },
        mcpClient: { select: { name: true } },
      },
    }),
  ]);

  const items: AuditLogListItem[] = rows.map((row) => ({
    id: row.id,
    actorType: row.actorType,
    actorName: row.actorUser?.name ?? row.mcpClient?.name ?? null,
    actorEmail: row.actorUser?.email ?? null,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    beforeJson: row.beforeJson,
    afterJson: row.afterJson,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    requestId: row.requestId,
    createdAt: row.createdAt,
  }));

  return { items, total, page, pageSize };
}

export type AuditActorOption = { id: string; name: string };

export type AuditFilterOptions = {
  entityTypes: string[];
  actions: string[];
  actors: AuditActorOption[];
};

/**
 * Distinct filter option lists derived live from the log rows themselves
 * (rather than a hardcoded enum) — `action`/`entity_type` are free-form
 * strings (spec §29), so a string introduced by a later phase shows up in
 * the filter automatically.
 */
export async function listAuditFilterOptions(): Promise<AuditFilterOptions> {
  const [entityTypeRows, actionRows, actorRows] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.findMany({
      where: { actorUserId: { not: null } },
      distinct: ["actorUserId"],
      select: { actorUser: { select: { id: true, name: true } } },
    }),
  ]);

  const actorsById = new Map<string, string>();
  for (const row of actorRows) {
    if (row.actorUser) actorsById.set(row.actorUser.id, row.actorUser.name);
  }

  return {
    entityTypes: entityTypeRows.map((row) => row.entityType),
    actions: actionRows.map((row) => row.action),
    actors: Array.from(actorsById, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "vi")),
  };
}
