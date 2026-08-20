import { randomUUID } from "node:crypto";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { buildMcpServer } from "@/mcp/server";
import { verifyMcpRequest } from "@/mcp/auth";
import { isMcpRateLimited } from "@/mcp/rate-limit";

// Serverless-friendly: `createMcpHandler` defaults to stateless mode (no
// session store across requests), matching a Vercel deployment where
// consecutive calls may land on different instances — see plan.md Phase 15.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createMcpHandler(({ authInfo }) => buildMcpServer(authInfo!.clientId, authInfo!.extra!.createdByAdminId as string));

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { success: false, error: { code, message }, meta: { requestId: randomUUID() } },
    { status, headers: status === 401 ? { "WWW-Authenticate": 'Bearer realm="mcp"' } : undefined },
  );
}

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function handleRequest(request: Request): Promise<Response> {
  const authInfo = await verifyMcpRequest(request);
  if (!authInfo) {
    if (isMcpRateLimited(`ip:${clientIp(request)}`)) {
      return errorResponse(429, "RATE_LIMITED", "Quá nhiều yêu cầu, vui lòng thử lại sau.");
    }
    return errorResponse(401, "UNAUTHORIZED", "API key không hợp lệ hoặc đã bị thu hồi.");
  }
  if (isMcpRateLimited(`client:${authInfo.clientId}`)) {
    return errorResponse(429, "RATE_LIMITED", "Quá nhiều yêu cầu, vui lòng thử lại sau.");
  }
  return handler.fetch(request, { authInfo });
}

export { handleRequest as GET, handleRequest as POST, handleRequest as DELETE };
