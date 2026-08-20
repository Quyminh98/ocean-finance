import { authenticateMcpClient } from "@/server/services/mcp-client.service";

/**
 * Minimal `AuthInfo` shape the MCP SDK's `createMcpHandler`/`registerTool`
 * expect — see `@modelcontextprotocol/server`. `extra.createdByAdminId`
 * (SDK's free-form "additional data" bag) carries the API key's owning Admin
 * through to `buildMcpServer` for Phase 16 write tools (see mcp-client.service.ts).
 */
export type McpAuthInfo = { token: string; clientId: string; scopes: string[]; extra: { createdByAdminId: string } };

const BEARER_PREFIX = "bearer ";

/**
 * Extracts + verifies the `Authorization: Bearer <mcp_...>` header for a Phase 15
 * MCP request against `mcp-client.service.ts` (spec §31 "Header/transport credential
 * phải được xác thực trước khi chạy tool"). Returns null (never throws) for a missing
 * header, malformed key, or a key that `authenticateMcpClient` rejects (unknown/REVOKED)
 * — the route handler turns that into a plain 401.
 */
export async function verifyMcpRequest(request: Request): Promise<McpAuthInfo | null> {
  const header = request.headers.get("authorization");
  if (!header || !header.toLowerCase().startsWith(BEARER_PREFIX)) return null;

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) return null;

  const client = await authenticateMcpClient(token);
  if (!client) return null;

  return { token, clientId: client.id, scopes: ["mcp"], extra: { createdByAdminId: client.createdByAdminId } };
}
