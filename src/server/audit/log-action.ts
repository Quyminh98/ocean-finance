import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { AuditActorType } from "@/generated/prisma/client";

type LogActionInput = {
  actorType: AuditActorType;
  actorUserId?: string | null;
  mcpClientId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string;
};

/**
 * Hard cap on `AuditLog` row count (user request 2026-08-19, confirmed
 * accepting real deletion + history loss — see `schema.md` Changelog). Oldest
 * rows are hard-deleted once the table exceeds this, no soft delete/archive.
 * This reverses the earlier "append-only, không sửa/xoá" rule for this table
 * specifically — every other financial entity's soft-delete rule is unchanged.
 */
export const AUDIT_LOG_MAX_ROWS = 5000;

/** Trims `AuditLog` down to `maxRows`, oldest first. Exported separately from `logAction` so tests can exercise it with a small `maxRows` instead of needing 5000+ real rows. */
export async function trimAuditLog(maxRows: number = AUDIT_LOG_MAX_ROWS): Promise<void> {
  const total = await prisma.auditLog.count();
  const excess = total - maxRows;
  if (excess <= 0) return;

  const oldest = await prisma.auditLog.findMany({
    orderBy: { createdAt: "asc" },
    take: excess,
    select: { id: true },
  });
  await prisma.auditLog.deleteMany({ where: { id: { in: oldest.map((row) => row.id) } } });
}

/** Audit trail write. Reused by every mutation across Web + MCP (CLAUDE.md "Service Layer dùng chung"). Trims to `AUDIT_LOG_MAX_ROWS` after each insert (see `trimAuditLog`). */
export async function logAction(input: LogActionInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      mcpClientId: input.mcpClientId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: input.beforeJson === undefined ? undefined : (input.beforeJson as object),
      afterJson: input.afterJson === undefined ? undefined : (input.afterJson as object),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      requestId: input.requestId ?? randomUUID(),
    },
  });
  await trimAuditLog();
}

/**
 * Every mutation service function takes an `adminId` (the Web actor) and logs
 * `actorType: "USER", actorUserId: adminId` at the end. Phase 16 (MCP write
 * tools) reuses these exact same service functions with quyền Admin Full,
 * but the caller isn't a logged-in Admin — it's an MCP client acting on that
 * Admin's behalf (spec §53 "Khi MCP sửa revenue... actor_type = MCP"). The
 * MCP tool layer still passes a real `adminId` (the API key's
 * `McpClient.created_by_admin_id`) for business fields that need one
 * (`created_by_admin_id`/`assigned_by_admin_id`), but the *audit* actor must
 * read MCP — `meta.actorMcpClientId` (set only by `src/mcp/server.ts`)
 * overrides the default USER/adminId attribution here, at the single place
 * every service's `logAction` call already goes through.
 */
export function auditActorFields(
  adminId: string,
  meta: { actorMcpClientId?: string | null },
): Pick<LogActionInput, "actorType" | "actorUserId" | "mcpClientId"> {
  if (meta.actorMcpClientId) return { actorType: "MCP", mcpClientId: meta.actorMcpClientId };
  return { actorType: "USER", actorUserId: adminId };
}
