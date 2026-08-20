import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createMcpClient, listMcpClients, revokeMcpClient, McpClientError } from "@/server/services/mcp-client.service";

let actorAdminId: string;
const createdUserIds: string[] = [];
const createdClientIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (mcp-client-service)",
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  actorAdminId = admin.id;
  createdUserIds.push(admin.id);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: createdClientIds } } });
  await prisma.mcpClient.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("createMcpClient", () => {
  it("generates a plaintext key returned only once, persists just its hash, and writes a CREATE audit entry", async () => {
    const result = await createMcpClient(`Test Client ${randomUUID()}`, actorAdminId);
    createdClientIds.push(result.id);

    expect(result.apiKey).toMatch(/^mcp_/);

    const row = await prisma.mcpClient.findUnique({ where: { id: result.id } });
    expect(row?.status).toBe("ACTIVE");
    expect(row?.apiKeyHash).not.toBe(result.apiKey);
    expect(row?.apiKeyHash).toHaveLength(64); // sha256 hex digest
    expect(row?.permissionsJson).toEqual({ scope: "ADMIN_FULL" });

    const auditCount = await prisma.auditLog.count({
      where: { entityType: "McpClient", entityId: result.id, action: "CREATE" },
    });
    expect(auditCount).toBe(1);
  });

  it("generates a distinct key (and hash) on every call", async () => {
    const a = await createMcpClient(`Test Client A ${randomUUID()}`, actorAdminId);
    const b = await createMcpClient(`Test Client B ${randomUUID()}`, actorAdminId);
    createdClientIds.push(a.id, b.id);

    expect(a.apiKey).not.toBe(b.apiKey);
    const rowA = await prisma.mcpClient.findUnique({ where: { id: a.id } });
    const rowB = await prisma.mcpClient.findUnique({ where: { id: b.id } });
    expect(rowA?.apiKeyHash).not.toBe(rowB?.apiKeyHash);
  });
});

describe("listMcpClients", () => {
  it("lists clients newest-first without ever exposing the plaintext key", async () => {
    const result = await createMcpClient(`List Test ${randomUUID()}`, actorAdminId);
    createdClientIds.push(result.id);

    const clients = await listMcpClients();
    const found = clients.find((c) => c.id === result.id);
    expect(found).toBeDefined();
    expect(found).not.toHaveProperty("apiKey");
    expect(found).not.toHaveProperty("apiKeyHash");
    expect(clients[0]?.createdAt.getTime()).toBeGreaterThanOrEqual(clients[clients.length - 1]?.createdAt.getTime() ?? 0);
  });
});

describe("revokeMcpClient", () => {
  it("sets status=REVOKED, stamps revokedAt, and writes a REVOKE audit entry", async () => {
    const created = await createMcpClient(`Revoke Test ${randomUUID()}`, actorAdminId);
    createdClientIds.push(created.id);

    await revokeMcpClient(created.id, actorAdminId);

    const row = await prisma.mcpClient.findUnique({ where: { id: created.id } });
    expect(row?.status).toBe("REVOKED");
    expect(row?.revokedAt).not.toBeNull();

    const auditCount = await prisma.auditLog.count({
      where: { entityType: "McpClient", entityId: created.id, action: "REVOKE" },
    });
    expect(auditCount).toBe(1);
  });

  it("rejects revoking an already-revoked client", async () => {
    const created = await createMcpClient(`Double Revoke ${randomUUID()}`, actorAdminId);
    createdClientIds.push(created.id);

    await revokeMcpClient(created.id, actorAdminId);
    await expect(revokeMcpClient(created.id, actorAdminId)).rejects.toThrow(McpClientError);
  });

  it("rejects an unknown client id", async () => {
    await expect(revokeMcpClient(randomUUID(), actorAdminId)).rejects.toThrow(McpClientError);
  });
});
