import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { logAction } from "@/server/audit/log-action";
import type { McpClientStatus } from "@/generated/prisma/client";

export class McpClientError extends Error {
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

export type McpClientListItem = {
  id: string;
  name: string;
  status: McpClientStatus;
  lastUsedAt: Date | null;
  createdAt: Date;
};

/** Ordered newest-first — internal tool, expect a handful of AI clients, no pagination/filter needed. */
export async function listMcpClients(): Promise<McpClientListItem[]> {
  const rows = await prisma.mcpClient.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
  }));
}

function generateApiKey(): string {
  // 32 random bytes -> 43-char base64url string, prefixed so a leaked key is
  // recognizable at a glance (same spirit as Stripe/GitHub token prefixes).
  return `mcp_${randomBytes(32).toString("base64url")}`;
}

/**
 * SHA-256, not bcrypt: unlike a user password, this key is already
 * high-entropy random data (not something a human chose/reused), so a fast
 * deterministic hash is the standard approach for API keys — it also lets
 * Phase 15 auth look the client up by `apiKeyHash` directly instead of
 * bcrypt-comparing against every ACTIVE row.
 */
function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export type CreateMcpClientResult = {
  id: string;
  name: string;
  apiKey: string;
};

export async function createMcpClient(
  name: string,
  adminId: string,
  meta: AuditMeta = {},
): Promise<CreateMcpClientResult> {
  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  const client = await prisma.mcpClient.create({
    data: {
      name,
      apiKeyHash,
      status: "ACTIVE",
      permissionsJson: { scope: "ADMIN_FULL" },
      createdByAdminId: adminId,
    },
  });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: "CREATE",
    entityType: "McpClient",
    entityId: client.id,
    afterJson: { name: client.name, status: client.status },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { id: client.id, name: client.name, apiKey };
}

export type AuthenticatedMcpClient = { id: string; name: string; createdByAdminId: string };

/**
 * Phase 15 MCP tool-call auth — hash lookup (no unique index on
 * `apiKeyHash`, `findFirst` is fine at this scale: schema.md wasn't changed
 * for a handful of clients, see plan.md Phase 15) + status check + bump
 * `last_used_at`. Returns null (never throws) for an unknown key or a
 * `REVOKED` client, so the route handler can turn it into a plain 401.
 *
 * `createdByAdminId` is returned for Phase 16 write tools — MCP has no
 * "logged-in Admin" of its own, so business fields that record which Admin
 * created/assigned a record (`created_by_admin_id`/`assigned_by_admin_id`)
 * fall back to the Admin who created this API key, mirroring how a Web
 * session's Admin id is used today. The Audit Log actor is a separate
 * concern — that's always `actor_type=MCP` regardless (see `auditActorFields`).
 */
export async function authenticateMcpClient(apiKey: string): Promise<AuthenticatedMcpClient | null> {
  const apiKeyHash = hashApiKey(apiKey);
  const client = await prisma.mcpClient.findFirst({ where: { apiKeyHash, status: "ACTIVE" } });
  if (!client) return null;

  await prisma.mcpClient.update({ where: { id: client.id }, data: { lastUsedAt: new Date() } });
  return { id: client.id, name: client.name, createdByAdminId: client.createdByAdminId };
}

export async function revokeMcpClient(clientId: string, adminId: string, meta: AuditMeta = {}): Promise<void> {
  const client = await prisma.mcpClient.findUnique({ where: { id: clientId } });
  if (!client) throw new McpClientError("Không tìm thấy MCP client.", "NOT_FOUND");
  if (client.status === "REVOKED") throw new McpClientError("MCP client này đã bị thu hồi trước đó.", "ALREADY_REVOKED");

  await prisma.mcpClient.update({
    where: { id: clientId },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  await logAction({
    actorType: "USER",
    actorUserId: adminId,
    action: "REVOKE",
    entityType: "McpClient",
    entityId: clientId,
    beforeJson: { status: client.status },
    afterJson: { status: "REVOKED" },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
