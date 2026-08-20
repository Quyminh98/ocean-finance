import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { logAction } from "@/server/audit/log-action";

/** Thrown by a tool's `run()` to produce a specific `error.code` in the spec §34 envelope (e.g. "EMPLOYEE_NOT_FOUND") instead of the generic INTERNAL_ERROR fallback. */
export class McpToolError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

/** JSON.stringify replacer — BIGINT VND amounts (CLAUDE.md "Database") have no native JSON representation. */
function bigIntSafe(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? Number(value) : value;
}

const GENERIC_INTERNAL_ERROR = { code: "INTERNAL_ERROR", message: "Đã có lỗi xảy ra, vui lòng thử lại." };

/** Any Prisma runtime exception (query/validation/connection/panic) — carries driver-level detail (SQL fragments, column/constraint names) that must never reach an MCP client, even an authenticated one (defense in depth). */
function isPrismaError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  );
}

/**
 * Every Service Layer error (`PageError`, `RevenueError`, ... — see the
 * `XxxError extends Error { code: string }` pattern used throughout
 * `server/services/*.ts`) is intentionally user-facing: its `message` is a
 * hand-written Vietnamese string safe to hand back to the caller, same as
 * `McpToolError`. A bare `"code" in error` check isn't enough to identify
 * those, though — Prisma's own runtime errors also carry a string `.code`
 * (e.g. `"P2002"`) and their `.message` includes raw driver/SQL detail, so
 * Prisma errors are excluded first and always collapse to a generic message.
 */
function toErrorEnvelope(error: unknown): { code: string; message: string } {
  if (error instanceof McpToolError) return { code: error.code, message: error.message };
  if (isPrismaError(error)) return GENERIC_INTERNAL_ERROR;
  // A string `.code` is this codebase's marker for a deliberate, user-facing
  // Service Layer error (see doc comment above) — anything else (TypeError,
  // RangeError, an uncaught bug) has no such marker and its raw `.message`
  // could describe internal code structure, so it also collapses to generic.
  if (error instanceof Error && "code" in error && typeof (error as { code?: unknown }).code === "string") {
    return { code: (error as { code: string }).code, message: error.message };
  }
  return GENERIC_INTERNAL_ERROR;
}

/**
 * Wraps a single MCP tool's business logic with the spec §34 response
 * envelope (`{success,data,meta:{requestId}}` / `{success:false,error:{code,message},meta}`)
 * and the spec §29 "MCP actions" audit trail — every call, read or write, is
 * logged with `actor_type=MCP` (plan.md Phase 15 point 4: "audit toàn bộ để
 * không thiếu"), including calls that fail. `entityId` defaults to the
 * generated `requestId` when the call has no single natural entity (list/
 * dashboard/search tools); pass the real id for single-entity reads (e.g.
 * `get_employee_detail`) so the Audit Log links back to that record.
 *
 * `auditOnSuccess` (default `true`) skips the wrapper's own success-path
 * `logAction` call — Phase 16 write tools call the same Service Layer
 * functions Web uses, and those already write their own, richer AuditLog
 * entry (real `action`/`before_json`/`after_json`, spec §53) via
 * `auditActorFields`/`meta.actorMcpClientId`. Without this, a successful
 * write would produce two rows for one mutation. Failures still always log
 * here (`run()` throwing means the service never reached its own
 * `logAction` call, so this is the only record of the attempt).
 */
export async function runMcpTool<T>(opts: {
  mcpClientId: string;
  action: string;
  entityType: string;
  entityId?: string;
  auditOnSuccess?: boolean;
  run: () => Promise<T>;
}): Promise<ToolResult> {
  const requestId = randomUUID();
  const entityId = opts.entityId ?? requestId;

  try {
    const data = await opts.run();
    if (opts.auditOnSuccess ?? true) {
      await logAction({
        actorType: "MCP",
        mcpClientId: opts.mcpClientId,
        action: opts.action,
        entityType: opts.entityType,
        entityId,
        requestId,
      });
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, data, meta: { requestId } }, bigIntSafe) }],
    };
  } catch (error) {
    const errorEnvelope = toErrorEnvelope(error);
    await logAction({
      actorType: "MCP",
      mcpClientId: opts.mcpClientId,
      action: opts.action,
      entityType: opts.entityType,
      entityId,
      afterJson: { error: errorEnvelope },
      requestId,
    });
    return {
      content: [{ type: "text", text: JSON.stringify({ success: false, error: errorEnvelope, meta: { requestId } }) }],
      isError: true,
    };
  }
}
