import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { logAction, trimAuditLog, AUDIT_LOG_MAX_ROWS } from "@/server/audit/log-action";

// `trimAuditLog` operates on the WHOLE `AuditLog` table, no entityType scoping
// (user request 2026-08-19 — see schema.md Changelog). This dev DB already has
// thousands of unrelated real rows, so every fixture row here is timestamped
// in the far past — guaranteed older than anything else in the table — so
// trimming is deterministic and never touches unrelated data.
const FAR_PAST = new Date("2000-01-01T00:00:00.000Z");

function fixtureRow(offsetMs: number) {
  return {
    actorType: "MCP" as const,
    action: "READ",
    entityType: "TrimAuditLogTestFixture",
    entityId: randomUUID(),
    requestId: randomUUID(),
    createdAt: new Date(FAR_PAST.getTime() + offsetMs),
  };
}

describe("trimAuditLog", () => {
  it("is a no-op when the table is under the limit", async () => {
    const totalBefore = await prisma.auditLog.count();
    await trimAuditLog(totalBefore + 1000);
    expect(await prisma.auditLog.count()).toBe(totalBefore);
  });

  it("hard-deletes exactly the oldest rows once over the limit, newest rows survive", async () => {
    const totalBefore = await prisma.auditLog.count();

    const rows = await Promise.all([0, 1, 2, 3, 4].map((i) => prisma.auditLog.create({ data: fixtureRow(i * 1000) })));
    const idsOldestFirst = rows.map((r) => r.id);

    // totalBefore + 5 fixture rows, trimmed back down to totalBefore + 2 -> exactly the 3 oldest fixture rows must go.
    await trimAuditLog(totalBefore + 2);

    const remaining = await prisma.auditLog.findMany({ where: { id: { in: idsOldestFirst } }, select: { id: true } });
    const remainingIds = new Set(remaining.map((r) => r.id));

    expect(remainingIds.size).toBe(2);
    expect(remainingIds.has(idsOldestFirst[0])).toBe(false);
    expect(remainingIds.has(idsOldestFirst[1])).toBe(false);
    expect(remainingIds.has(idsOldestFirst[2])).toBe(false);
    expect(remainingIds.has(idsOldestFirst[3])).toBe(true);
    expect(remainingIds.has(idsOldestFirst[4])).toBe(true);
    expect(await prisma.auditLog.count()).toBe(totalBefore + 2);

    await prisma.auditLog.deleteMany({ where: { id: { in: idsOldestFirst } } });
  });
});

describe("logAction", () => {
  it("keeps the table at or under AUDIT_LOG_MAX_ROWS after every write (spec/CLAUDE.md 2026-08-19)", async () => {
    const entityId = randomUUID();
    await logAction({ actorType: "MCP", action: "READ", entityType: "TrimAuditLogTestFixture", entityId });
    expect(await prisma.auditLog.count()).toBeLessThanOrEqual(AUDIT_LOG_MAX_ROWS);
    await prisma.auditLog.deleteMany({ where: { entityType: "TrimAuditLogTestFixture", entityId } });
  });
});
