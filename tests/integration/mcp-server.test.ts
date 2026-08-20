import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/db";
import { createEmployee } from "@/server/services/employee.service";
import { createPage } from "@/server/services/page.service";
import { createRevenue } from "@/server/services/revenue.service";
import { createMcpClient, revokeMcpClient } from "@/server/services/mcp-client.service";
import { buildMcpServer } from "@/mcp/server";
import { verifyMcpRequest } from "@/mcp/auth";
import { isMcpRateLimited } from "@/mcp/rate-limit";

// In-process harness mirroring `src/app/api/mcp/route.ts` exactly (same
// verifyMcpRequest -> rate-limit -> handler.fetch wiring), per the SDK's
// documented "serve MCP handler in-process for testing" pattern — no real
// HTTP socket, no separate `next dev` process needed to exercise the full
// JSON-RPC layer.
const mcpHandler = createMcpHandler(({ authInfo }) => buildMcpServer(authInfo!.clientId, authInfo!.extra!.createdByAdminId as string));

async function routeFetch(url: string | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(url, init);
  const authInfo = await verifyMcpRequest(request);
  if (!authInfo) {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "API key không hợp lệ hoặc đã bị thu hồi." } },
      { status: 401 },
    );
  }
  if (isMcpRateLimited(`client:${authInfo.clientId}`)) {
    return Response.json(
      { success: false, error: { code: "RATE_LIMITED", message: "Quá nhiều yêu cầu, vui lòng thử lại sau." } },
      { status: 429 },
    );
  }
  return mcpHandler.fetch(request, { authInfo });
}

async function connectClient(apiKey: string): Promise<Client> {
  const client = new Client({ name: "test-harness", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
    fetch: routeFetch,
    requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
  });
  await client.connect(transport);
  return client;
}

/**
 * A fresh `McpClient` (own 60-req/60s budget, plan.md Phase 15 point 5) per
 * caller — the "Write MCP tools" suite below makes many more tool calls in
 * quick succession than the read-only suite above; sharing one client across
 * all of it would make the tests flaky depending on run order/timing. Pushes
 * the new client id onto `createdMcpClientIds` so the shared `afterAll`
 * cleans it up like every other fixture client.
 */
async function connectFreshWriteClient(): Promise<Client> {
  const { id, apiKey } = await createMcpClient(`Test MCP Client (write-${randomUUID()}) `, adminId);
  createdMcpClientIds.push(id);
  return connectClient(apiKey);
}

function parseEnvelope(result: Awaited<ReturnType<Client["callTool"]>>): { success: boolean; data?: unknown; error?: { code: string; message: string } } {
  const text = (result.content as Array<{ type: string; text?: string }>).find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Tool call returned no text content");
  return JSON.parse(text);
}

let adminId: string;
let employeeId: string;
let pageId: string;
let mcpClientId: string;
let apiKey: string;
let revokedClientId: string;
let revokedApiKey: string;
const createdUserIds: string[] = [];
const createdPageIds: string[] = [];
const createdMcpClientIds: string[] = [];
const createdAdminExpenseIds: string[] = [];
const createdAdminReceiptIds: string[] = [];
const createdEmployeeReceiptIds: string[] = [];
const createdPageStatusOptionIds: string[] = [];

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      name: "Test Admin (mcp-server)",
      email: `test-admin-${randomUUID()}@example.test`,
      passwordHash: "x",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;
  createdUserIds.push(admin.id);

  const employee = await createEmployee(
    { name: "MCP Test Employee", email: `test-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    adminId,
  );
  employeeId = employee.employeeId;
  createdUserIds.push(employee.userId);

  const page = await createPage(
    {
      name: `MCP Test Page ${randomUUID()}`,
      facebookUrl: "https://facebook.com/mcp-test-page",
      purchasePrice: 0n,
      purchaseMonth: new Date("2026-08-01"),
      assignEmployeeId: employeeId,
    },
    adminId,
  );
  pageId = page.pageId;
  createdPageIds.push(pageId);

  await createRevenue({ pageId, revenueMonth: new Date("2026-08-01"), amount: 15_000_000n }, adminId);

  const active = await createMcpClient(`Test MCP Client ${randomUUID()}`, adminId);
  mcpClientId = active.id;
  apiKey = active.apiKey;
  createdMcpClientIds.push(active.id);

  const revoked = await createMcpClient(`Test MCP Client (revoked) ${randomUUID()}`, adminId);
  revokedClientId = revoked.id;
  revokedApiKey = revoked.apiKey;
  createdMcpClientIds.push(revoked.id);
  await revokeMcpClient(revokedClientId, adminId);
});

afterAll(async () => {
  const revenues = await prisma.revenue.findMany({ where: { pageId: { in: createdPageIds } }, select: { id: true } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { mcpClientId: { in: createdMcpClientIds } },
        { entityId: { in: [...createdPageIds, ...createdMcpClientIds, employeeId, ...revenues.map((r) => r.id)] } },
      ],
    },
  });
  await prisma.revenue.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.adExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.adminExpense.deleteMany({ where: { id: { in: createdAdminExpenseIds } } });
  await prisma.adminReceipt.deleteMany({ where: { id: { in: createdAdminReceiptIds } } });
  await prisma.employeeReceipt.deleteMany({ where: { id: { in: createdEmployeeReceiptIds } } });
  // delete_page_status_option is a hard delete (spec §15.3) — its own test already
  // removes the row, this is just a defensive catch-all if that step never ran.
  await prisma.pageStatusOption.deleteMany({ where: { id: { in: createdPageStatusOptionIds } } });
  await prisma.pagePurchaseExpense.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.pageAssignment.deleteMany({ where: { pageId: { in: createdPageIds } } });
  await prisma.page.deleteMany({ where: { id: { in: createdPageIds } } });
  await prisma.mcpClient.deleteMany({ where: { id: { in: createdMcpClientIds } } });
  await prisma.salaryHistory.deleteMany({ where: { employee: { userId: { in: createdUserIds } } } });
  await prisma.employeeProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("MCP auth (spec §31, plan.md Phase 15)", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await routeFetch("http://test.local/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects an unknown/garbage API key", async () => {
    const res = await routeFetch("http://test.local/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer mcp_not_a_real_key" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects a REVOKED client's key even though the key itself is well-formed", async () => {
    const res = await routeFetch("http://test.local/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${revokedApiKey}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
  });

  it("accepts an ACTIVE client's key and bumps last_used_at", async () => {
    const before = await prisma.mcpClient.findUniqueOrThrow({ where: { id: mcpClientId } });
    expect(before.lastUsedAt).toBeNull();

    const client = await connectClient(apiKey);
    await client.close();

    const after = await prisma.mcpClient.findUniqueOrThrow({ where: { id: mcpClientId } });
    expect(after.lastUsedAt).not.toBeNull();
  });
});

describe("Read-only MCP tools (spec §32/§34, plan.md Phase 15)", () => {
  it("get_dashboard returns the spec §32 field names and matches getSystemFinancials", async () => {
    const client = await connectClient(apiKey);
    const result = await client.callTool({ name: "get_dashboard", arguments: { month: "2026-08" } });
    const envelope = parseEnvelope(result);
    await client.close();

    expect(result.isError).not.toBe(true);
    expect(envelope.success).toBe(true);
    const data = envelope.data as Record<string, number>;
    expect(data.totalRevenue).toBeGreaterThanOrEqual(15_000_000);
    expect(["totalRevenue", "totalReceived", "totalExpenses", "profit", "totalSalary", "totalAds"].every((key) => key in data)).toBe(
      true,
    );
  });

  it("list_employees finds the fixture by search and status filter", async () => {
    const client = await connectClient(apiKey);
    const result = await client.callTool({
      name: "list_employees",
      arguments: { search: "MCP Test Employee", status: "ACTIVE" },
    });
    const envelope = parseEnvelope(result);
    await client.close();

    expect(envelope.success).toBe(true);
    const data = envelope.data as { items: Array<{ employeeId: string; name: string }> };
    expect(data.items.some((item) => item.employeeId === employeeId)).toBe(true);
  });

  it("get_employee_detail returns financials scoped to the given month", async () => {
    const client = await connectClient(apiKey);
    const result = await client.callTool({ name: "get_employee_detail", arguments: { employeeId, month: "2026-08" } });
    const envelope = parseEnvelope(result);
    await client.close();

    expect(envelope.success).toBe(true);
    const data = envelope.data as { name: string; revenue: number };
    expect(data.name).toBe("MCP Test Employee");
    expect(data.revenue).toBe(15_000_000);
  });

  it("get_employee_detail returns a structured EMPLOYEE_NOT_FOUND error for an unknown id", async () => {
    const client = await connectClient(apiKey);
    const result = await client.callTool({ name: "get_employee_detail", arguments: { employeeId: randomUUID() } });
    const envelope = parseEnvelope(result);
    await client.close();

    expect(result.isError).toBe(true);
    expect(envelope.success).toBe(false);
    expect(envelope.error?.code).toBe("EMPLOYEE_NOT_FOUND");
  });

  it("list_pages and get_page_detail return the fixture Page with its current employee", async () => {
    const client = await connectClient(apiKey);
    const listResult = await client.callTool({ name: "list_pages", arguments: { employeeId } });
    const listEnvelope = parseEnvelope(listResult);
    const detailResult = await client.callTool({ name: "get_page_detail", arguments: { pageId } });
    const detailEnvelope = parseEnvelope(detailResult);
    await client.close();

    const listData = listEnvelope.data as { items: Array<{ pageId: string }> };
    expect(listData.items.some((item) => item.pageId === pageId)).toBe(true);

    const detailData = detailEnvelope.data as { currentEmployee: { employeeId: string } | null };
    expect(detailData.currentEmployee?.employeeId).toBe(employeeId);
  });

  it("list_revenue returns the fixture Revenue with the money amount as a plain number (BigInt-safe)", async () => {
    const client = await connectClient(apiKey);
    const result = await client.callTool({ name: "list_revenue", arguments: { pageId } });
    const envelope = parseEnvelope(result);
    await client.close();

    const data = envelope.data as { items: Array<{ amount: number; pageId: string }> };
    const row = data.items.find((item) => item.pageId === pageId);
    expect(row?.amount).toBe(15_000_000);
    expect(typeof row?.amount).toBe("number");
  });

  it("search_audit_logs can find its own prior MCP tool calls (actor_type=MCP)", async () => {
    const client = await connectClient(apiKey);
    const result = await client.callTool({
      name: "search_audit_logs",
      arguments: { entityType: "Employee", action: "READ" },
    });
    const envelope = parseEnvelope(result);
    await client.close();

    expect(envelope.success).toBe(true);
    const data = envelope.data as { items: Array<{ actorType: string }> };
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((item) => item.actorType === "MCP")).toBe(true);
  });

  it("writes an actor_type=MCP audit entry for every tool call, success and failure alike", async () => {
    const countBefore = await prisma.auditLog.count({ where: { mcpClientId, action: "READ" } });

    const client = await connectClient(apiKey);
    await client.callTool({ name: "get_page_detail", arguments: { pageId } });
    await client.callTool({ name: "get_page_detail", arguments: { pageId: randomUUID() } }); // NOT_FOUND — still logged
    await client.close();

    const countAfter = await prisma.auditLog.count({ where: { mcpClientId, action: "READ" } });
    expect(countAfter - countBefore).toBe(2);

    const lastEntry = await prisma.auditLog.findFirst({
      where: { mcpClientId, entityType: "Page" },
      orderBy: { createdAt: "desc" },
    });
    expect(lastEntry?.actorType).toBe("MCP");
    expect(lastEntry?.actorUserId).toBeNull();
  });
});

describe("Write MCP tools (spec §32/§33/§53, plan.md Phase 16)", () => {
  let flowPageId: string;
  let flowEmployeeId: string;
  let flowRevenueId: string;
  let flowAdExpenseId: string;
  let flowAdminExpenseId: string;
  let flowAdminReceiptId: string;
  let flowEmployeeReceiptId: string;
  let flowPageStatusOptionId: string;

  it("create_employee creates a User+EmployeeProfile and returns a one-time temp password", async () => {
    const client = await connectFreshWriteClient();
    const result = await client.callTool({
      name: "create_employee",
      arguments: { name: "MCP Write Employee", email: `mcp-write-employee-${randomUUID()}@example.test`, status: "ACTIVE" },
    });
    const envelope = parseEnvelope(result);
    await client.close();

    expect(envelope.success).toBe(true);
    const data = envelope.data as { employeeId: string; userId: string; tempPassword: string };
    expect(data.tempPassword.length).toBeGreaterThan(0);
    flowEmployeeId = data.employeeId;
    createdUserIds.push(data.userId);

    const auditEntry = await prisma.auditLog.findFirst({
      where: { entityType: "Employee", entityId: data.employeeId, action: "CREATE" },
    });
    expect(auditEntry?.actorType).toBe("MCP");
    expect(auditEntry?.mcpClientId).not.toBeNull();
    expect(auditEntry?.actorUserId).toBeNull();
  });

  it("update_employee edits name/email/status and writes a single actor_type=MCP UPDATE entry (spec §53)", async () => {
    const newEmail = `mcp-write-employee-updated-${randomUUID()}@example.test`;
    const countBefore = await prisma.auditLog.count({ where: { entityType: "Employee", entityId: flowEmployeeId } });

    const client = await connectFreshWriteClient();
    const result = await client.callTool({
      name: "update_employee",
      arguments: { employeeId: flowEmployeeId, name: "MCP Write Employee (updated)", email: newEmail, status: "ACTIVE" },
    });
    const envelope = parseEnvelope(result);
    await client.close();

    expect(envelope.success).toBe(true);
    const countAfter = await prisma.auditLog.count({ where: { entityType: "Employee", entityId: flowEmployeeId } });
    expect(countAfter - countBefore).toBe(1); // exactly one row — no wrapper duplicate on top of the service's own log

    const auditEntry = await prisma.auditLog.findFirst({
      where: { entityType: "Employee", entityId: flowEmployeeId, action: "UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(auditEntry?.actorType).toBe("MCP");
    expect((auditEntry?.afterJson as { email: string } | null)?.email).toBe(newEmail);
  });

  it("set_employee_salary sets the current rate, effective today", async () => {
    const client = await connectFreshWriteClient();
    const result = await client.callTool({
      name: "set_employee_salary",
      arguments: { employeeId: flowEmployeeId, monthlySalary: 12_000_000, paidByAdminId: adminId },
    });
    const envelope = parseEnvelope(result);
    await client.close();

    expect(envelope.success).toBe(true);
    const profile = await prisma.employeeProfile.findUnique({
      where: { id: flowEmployeeId },
      include: { salaryHistories: { where: { effectiveTo: null } } },
    });
    expect(profile?.salaryHistories[0]?.monthlySalary).toBe(12_000_000n);
    expect(profile?.salaryHistories[0]?.paidByAdminId).toBe(adminId);
  });

  it("deactivate_employee rejects without confirm:true, succeeds with it (spec §33)", async () => {
    const client = await connectFreshWriteClient();
    const rejected = await client.callTool({ name: "deactivate_employee", arguments: { employeeId: flowEmployeeId } });
    const rejectedEnvelope = parseEnvelope(rejected);
    expect(rejectedEnvelope.success).toBe(false);
    expect(rejectedEnvelope.error?.code).toBe("CONFIRMATION_REQUIRED");

    const confirmed = await client.callTool({
      name: "deactivate_employee",
      arguments: { employeeId: flowEmployeeId, confirm: true },
    });
    const confirmedEnvelope = parseEnvelope(confirmed);
    await client.close();

    expect(confirmedEnvelope.success).toBe(true);
    const user = await prisma.user.findFirst({ where: { employeeProfile: { id: flowEmployeeId } } });
    expect(user?.status).toBe("INACTIVE");
  });

  it("create_page creates a bare (unassigned) BKT Page requiring paidByAdminId once purchasePrice > 0", async () => {
    const client = await connectFreshWriteClient();
    const missingPayer = await client.callTool({
      name: "create_page",
      arguments: {
        name: `MCP Write Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/mcp-write-page",
        purchasePrice: 5_000_000,
        purchaseMonth: "2026-09",
      },
    });
    expect(parseEnvelope(missingPayer).success).toBe(false);

    const result = await client.callTool({
      name: "create_page",
      arguments: {
        name: `MCP Write Page ${randomUUID()}`,
        facebookUrl: "https://facebook.com/mcp-write-page",
        purchasePrice: 5_000_000,
        purchaseMonth: "2026-09",
        paidByAdminId: adminId,
      },
    });
    const envelope = parseEnvelope(result);
    await client.close();

    expect(envelope.success).toBe(true);
    const data = envelope.data as { pageId: string };
    flowPageId = data.pageId;
    createdPageIds.push(flowPageId);

    const page = await prisma.page.findUniqueOrThrow({ where: { id: flowPageId } });
    expect(page.paidByAdminId).toBe(adminId);
    expect(page.purchasePrice).toBe(5_000_000n);
  });

  it("update_page edits name/URL/notes", async () => {
    const client = await connectFreshWriteClient();
    const result = await client.callTool({
      name: "update_page",
      arguments: { pageId: flowPageId, name: "MCP Write Page (updated)", facebookUrl: "https://facebook.com/mcp-write-page-2" },
    });
    const envelope = parseEnvelope(result);
    await client.close();

    expect(envelope.success).toBe(true);
    const page = await prisma.page.findUniqueOrThrow({ where: { id: flowPageId } });
    expect(page.name).toBe("MCP Write Page (updated)");
  });

  it("assign_employee assigns the fixture employee to the bare Page and snapshots the deferred PagePurchaseExpense", async () => {
    const client = await connectFreshWriteClient();
    const result = await client.callTool({
      name: "assign_employee",
      arguments: { pageId: flowPageId, employeeId, effectiveDate: "2026-09-01" },
    });
    const envelope = parseEnvelope(result);
    await client.close();

    expect(envelope.success).toBe(true);
    const purchaseExpense = await prisma.pagePurchaseExpense.findUnique({ where: { pageId: flowPageId } });
    expect(purchaseExpense?.employeeIdSnapshot).toBe(employeeId);
    expect(purchaseExpense?.paidByAdminId).toBe(adminId);
  });

  it("create_revenue / update_revenue write a single actor_type=MCP entry each with before/after JSON (spec §53 exact example)", async () => {
    const client = await connectFreshWriteClient();
    const created = await client.callTool({
      name: "create_revenue",
      arguments: { pageId: flowPageId, revenueMonth: "2026-09", amount: 20_000_000, note: "mcp write test" },
    });
    const createdEnvelope = parseEnvelope(created);
    expect(createdEnvelope.success).toBe(true);
    flowRevenueId = (createdEnvelope.data as { revenueId: string }).revenueId;

    const countBefore = await prisma.auditLog.count({ where: { entityType: "Revenue", entityId: flowRevenueId } });
    const updated = await client.callTool({
      name: "update_revenue",
      arguments: { revenueId: flowRevenueId, pageId: flowPageId, revenueMonth: "2026-09", amount: 25_000_000, note: "mcp write test v2" },
    });
    const updatedEnvelope = parseEnvelope(updated);
    await client.close();

    expect(updatedEnvelope.success).toBe(true);
    const countAfter = await prisma.auditLog.count({ where: { entityType: "Revenue", entityId: flowRevenueId } });
    expect(countAfter - countBefore).toBe(1);

    const auditEntry = await prisma.auditLog.findFirst({
      where: { entityType: "Revenue", entityId: flowRevenueId, action: "UPDATE" },
    });
    expect(auditEntry?.actorType).toBe("MCP");
    expect(auditEntry?.beforeJson).not.toBeNull();
    expect((auditEntry?.afterJson as { amount: string } | null)?.amount).toBe("25000000");

    const revenue = await prisma.revenue.findUniqueOrThrow({ where: { id: flowRevenueId } });
    expect(revenue.amount).toBe(25_000_000n);
    expect(revenue.employeeIdSnapshot).toBe(employeeId);
  });

  it("delete_revenue rejects without confirm:true, soft-deletes with it", async () => {
    const client = await connectFreshWriteClient();
    const rejected = await client.callTool({ name: "delete_revenue", arguments: { revenueId: flowRevenueId } });
    expect(parseEnvelope(rejected).success).toBe(false);

    const confirmed = await client.callTool({ name: "delete_revenue", arguments: { revenueId: flowRevenueId, confirm: true } });
    await client.close();

    expect(parseEnvelope(confirmed).success).toBe(true);
    const revenue = await prisma.revenue.findUniqueOrThrow({ where: { id: flowRevenueId } });
    expect(revenue.deletedAt).not.toBeNull();
  });

  it("create_ad_expense / update_ad_expense / delete_ad_expense round-trip, owner auto-resolved", async () => {
    const client = await connectFreshWriteClient();
    const created = await client.callTool({
      name: "create_ad_expense",
      arguments: { pageId: flowPageId, expenseMonth: "2026-09", amount: 1_000_000, paidByAdminId: adminId },
    });
    const createdEnvelope = parseEnvelope(created);
    expect(createdEnvelope.success).toBe(true);
    flowAdExpenseId = (createdEnvelope.data as { adExpenseId: string }).adExpenseId;

    const updated = await client.callTool({
      name: "update_ad_expense",
      arguments: {
        adExpenseId: flowAdExpenseId,
        pageId: flowPageId,
        expenseMonth: "2026-09",
        amount: 1_500_000,
        paidByAdminId: adminId,
      },
    });
    expect(parseEnvelope(updated).success).toBe(true);

    const rejectedDelete = await client.callTool({ name: "delete_ad_expense", arguments: { adExpenseId: flowAdExpenseId } });
    expect(parseEnvelope(rejectedDelete).success).toBe(false);

    const confirmedDelete = await client.callTool({
      name: "delete_ad_expense",
      arguments: { adExpenseId: flowAdExpenseId, confirm: true },
    });
    await client.close();

    expect(parseEnvelope(confirmedDelete).success).toBe(true);
    const adExpense = await prisma.adExpense.findUniqueOrThrow({ where: { id: flowAdExpenseId } });
    expect(adExpense.amount).toBe(1_500_000n);
    expect(adExpense.deletedAt).not.toBeNull();
  });

  it("transfer_page closes the active assignment and opens a new one, never touching prior snapshots", async () => {
    const client = await connectFreshWriteClient();
    const secondEmployee = await client.callTool({
      name: "create_employee",
      arguments: { name: "MCP Transfer Target", email: `mcp-transfer-target-${randomUUID()}@example.test`, status: "ACTIVE" },
    });
    const secondEmployeeData = parseEnvelope(secondEmployee).data as { employeeId: string; userId: string };
    createdUserIds.push(secondEmployeeData.userId);

    const before = await prisma.pagePurchaseExpense.findUnique({ where: { pageId: flowPageId } });

    const result = await client.callTool({
      name: "transfer_page",
      arguments: { pageId: flowPageId, newEmployeeId: secondEmployeeData.employeeId, effectiveDate: "2026-09-15" },
    });
    const envelope = parseEnvelope(result);
    await client.close();

    expect(envelope.success).toBe(true);
    const currentAssignment = await prisma.pageAssignment.findFirst({ where: { pageId: flowPageId, endedAt: null } });
    expect(currentAssignment?.employeeId).toBe(secondEmployeeData.employeeId);

    // Snapshot pattern — the PagePurchaseExpense created under the first employee never changes on transfer.
    const after = await prisma.pagePurchaseExpense.findUnique({ where: { pageId: flowPageId } });
    expect(after?.employeeIdSnapshot).toBe(before?.employeeIdSnapshot);
    expect(after?.employeeIdSnapshot).toBe(employeeId);
  });

  it("delete_page rejects without confirm:true, soft-deletes with it, leaving assignment/purchase history intact", async () => {
    const client = await connectFreshWriteClient();
    const rejected = await client.callTool({ name: "delete_page", arguments: { pageId: flowPageId } });
    expect(parseEnvelope(rejected).success).toBe(false);
    expect(parseEnvelope(rejected).error?.code).toBe("CONFIRMATION_REQUIRED");

    const confirmed = await client.callTool({ name: "delete_page", arguments: { pageId: flowPageId, confirm: true } });
    await client.close();

    expect(parseEnvelope(confirmed).success).toBe(true);
    const page = await prisma.page.findUniqueOrThrow({ where: { id: flowPageId } });
    expect(page.deletedAt).not.toBeNull();
    const assignmentCount = await prisma.pageAssignment.count({ where: { pageId: flowPageId } });
    expect(assignmentCount).toBe(2); // original + transfer — untouched by the delete
  });

  it("create_admin_expense / update_admin_expense / delete_admin_expense round-trip", async () => {
    const client = await connectFreshWriteClient();
    const created = await client.callTool({
      name: "create_admin_expense",
      arguments: { expenseDate: "2026-09-01", amount: 2_000_000, description: "MCP write test expense", paidByAdminId: adminId },
    });
    const createdEnvelope = parseEnvelope(created);
    expect(createdEnvelope.success).toBe(true);
    flowAdminExpenseId = (createdEnvelope.data as { adminExpenseId: string }).adminExpenseId;
    createdAdminExpenseIds.push(flowAdminExpenseId);

    const updated = await client.callTool({
      name: "update_admin_expense",
      arguments: {
        adminExpenseId: flowAdminExpenseId,
        expenseDate: "2026-09-02",
        amount: 2_500_000,
        description: "MCP write test expense v2",
        paidByAdminId: adminId,
      },
    });
    expect(parseEnvelope(updated).success).toBe(true);

    const confirmedDelete = await client.callTool({
      name: "delete_admin_expense",
      arguments: { adminExpenseId: flowAdminExpenseId, confirm: true },
    });
    await client.close();

    expect(parseEnvelope(confirmedDelete).success).toBe(true);
    const expense = await prisma.adminExpense.findUniqueOrThrow({ where: { id: flowAdminExpenseId } });
    expect(expense.amount).toBe(2_500_000n);
    expect(expense.deletedAt).not.toBeNull();
  });

  it("create_admin_receipt / update_admin_receipt / delete_admin_receipt round-trip", async () => {
    const client = await connectFreshWriteClient();
    const created = await client.callTool({
      name: "create_admin_receipt",
      arguments: { receiptMonth: "2026-09", amount: 3_000_000, source: "MCP write test receipt", receivedByAdminId: adminId },
    });
    const createdEnvelope = parseEnvelope(created);
    expect(createdEnvelope.success).toBe(true);
    flowAdminReceiptId = (createdEnvelope.data as { adminReceiptId: string }).adminReceiptId;
    createdAdminReceiptIds.push(flowAdminReceiptId);

    const updated = await client.callTool({
      name: "update_admin_receipt",
      arguments: {
        adminReceiptId: flowAdminReceiptId,
        receiptMonth: "2026-09",
        amount: 3_500_000,
        source: "MCP write test receipt v2",
        receivedByAdminId: adminId,
      },
    });
    expect(parseEnvelope(updated).success).toBe(true);

    const confirmedDelete = await client.callTool({
      name: "delete_admin_receipt",
      arguments: { adminReceiptId: flowAdminReceiptId, confirm: true },
    });
    await client.close();

    expect(parseEnvelope(confirmedDelete).success).toBe(true);
    const receipt = await prisma.adminReceipt.findUniqueOrThrow({ where: { id: flowAdminReceiptId } });
    expect(receipt.amount).toBe(3_500_000n);
    expect(receipt.deletedAt).not.toBeNull();
  });

  it("create_employee_receipt / update_employee_receipt / delete_employee_receipt round-trip, list_employee_receipts finds it (spec §20a, added 2026-08-20)", async () => {
    const client = await connectFreshWriteClient();
    const created = await client.callTool({
      name: "create_employee_receipt",
      arguments: { employeeId, receiptMonth: "2026-09", amount: 1_000_000 },
    });
    const createdEnvelope = parseEnvelope(created);
    expect(createdEnvelope.success).toBe(true);
    flowEmployeeReceiptId = (createdEnvelope.data as { employeeReceiptId: string }).employeeReceiptId;
    createdEmployeeReceiptIds.push(flowEmployeeReceiptId);

    const listed = await client.callTool({ name: "list_employee_receipts", arguments: { employeeId } });
    const listedEnvelope = parseEnvelope(listed);
    expect(listedEnvelope.success).toBe(true);
    expect((listedEnvelope.data as { items: Array<{ employeeReceiptId: string }> }).items.map((r) => r.employeeReceiptId)).toContain(
      flowEmployeeReceiptId,
    );

    const updated = await client.callTool({
      name: "update_employee_receipt",
      arguments: { employeeReceiptId: flowEmployeeReceiptId, employeeId, receiptMonth: "2026-09", amount: 1_200_000 },
    });
    expect(parseEnvelope(updated).success).toBe(true);

    const confirmedDelete = await client.callTool({
      name: "delete_employee_receipt",
      arguments: { employeeReceiptId: flowEmployeeReceiptId, confirm: true },
    });
    await client.close();

    expect(parseEnvelope(confirmedDelete).success).toBe(true);
    const receipt = await prisma.employeeReceipt.findUniqueOrThrow({ where: { id: flowEmployeeReceiptId } });
    expect(receipt.amount).toBe(1_200_000n);
    expect(receipt.deletedAt).not.toBeNull();
  });

  it("create_page_status_option / update_page_status_option / delete_page_status_option round-trip (hard delete), list_page_status_options finds it (spec §15.3, added 2026-08-20)", async () => {
    const client = await connectFreshWriteClient();
    const created = await client.callTool({
      name: "create_page_status_option",
      arguments: { label: `MCP test tag ${randomUUID().slice(0, 8)}`, color: "BLUE" },
    });
    const createdEnvelope = parseEnvelope(created);
    expect(createdEnvelope.success).toBe(true);
    flowPageStatusOptionId = (createdEnvelope.data as { optionId: string }).optionId;
    createdPageStatusOptionIds.push(flowPageStatusOptionId);

    const listed = await client.callTool({ name: "list_page_status_options", arguments: {} });
    const listedEnvelope = parseEnvelope(listed);
    expect(listedEnvelope.success).toBe(true);
    expect((listedEnvelope.data as Array<{ optionId: string }>).map((o) => o.optionId)).toContain(flowPageStatusOptionId);

    const updated = await client.callTool({
      name: "update_page_status_option",
      arguments: { optionId: flowPageStatusOptionId, label: "MCP test tag v2", color: "PINK" },
    });
    expect(parseEnvelope(updated).success).toBe(true);

    const rejectedDelete = await client.callTool({
      name: "delete_page_status_option",
      arguments: { optionId: flowPageStatusOptionId },
    });
    expect(parseEnvelope(rejectedDelete).error?.code).toBe("CONFIRMATION_REQUIRED");

    const confirmedDelete = await client.callTool({
      name: "delete_page_status_option",
      arguments: { optionId: flowPageStatusOptionId, confirm: true },
    });
    await client.close();

    expect(parseEnvelope(confirmedDelete).success).toBe(true);
    await expect(prisma.pageStatusOption.findUniqueOrThrow({ where: { id: flowPageStatusOptionId } })).rejects.toThrow();
  });
});

describe("MCP rate limiting (plan.md Phase 15 point 5)", () => {
  it("returns 429 once a single client exceeds the per-minute request budget", async () => {
    // Dedicated client so this test's 61 requests don't poison the shared
    // fixture client's quota for the describe blocks above.
    const rateLimited = await createMcpClient(`Test MCP Client (rate-limit) ${randomUUID()}`, adminId);
    createdMcpClientIds.push(rateLimited.id);

    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "get_dashboard", arguments: {} },
    });
    const init = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${rateLimited.apiKey}`,
      },
      body,
    };

    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) {
      const res = await routeFetch("http://test.local/mcp", init);
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 60).every((status) => status !== 429)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
});
