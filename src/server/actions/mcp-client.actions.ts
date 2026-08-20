"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/rbac";
import { CreateMcpClientSchema } from "@/server/validators/mcp-client.schema";
import { createMcpClient, revokeMcpClient, McpClientError } from "@/server/services/mcp-client.service";

async function auditMeta() {
  const requestHeaders = await headers();
  return {
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
  };
}

export type CreateMcpClientState =
  | { status: "error"; error: string; fieldErrors?: Record<string, string> }
  | { status: "success"; clientId: string; apiKey: string };

export async function createMcpClientAction(input: unknown): Promise<CreateMcpClientState> {
  const admin = await requireAdmin();

  const parsed = CreateMcpClientSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors };
  }

  const result = await createMcpClient(parsed.data.name, admin.id, await auditMeta());
  revalidatePath("/admin/settings/mcp");
  return { status: "success", clientId: result.id, apiKey: result.apiKey };
}

export type RevokeMcpClientState = { status: "error"; error: string } | { status: "success" } | undefined;

export async function revokeMcpClientAction(clientId: string): Promise<RevokeMcpClientState> {
  const admin = await requireAdmin();

  try {
    await revokeMcpClient(clientId, admin.id, await auditMeta());
    revalidatePath("/admin/settings/mcp");
    return { status: "success" };
  } catch (error) {
    if (error instanceof McpClientError) return { status: "error", error: error.message };
    throw error;
  }
}
