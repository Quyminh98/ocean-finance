import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { runMcpTool, McpToolError } from "@/mcp/tool-runner";
import { getSystemFinancials } from "@/server/services/dashboard.service";
import {
  listEmployees,
  getEmployeeDetail,
  getEmployeeFinancials,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
} from "@/server/services/employee.service";
import { setEmployeeSalary } from "@/server/services/salary.service";
import { listPages, getPageDetail, createPage, updatePage, softDeletePage } from "@/server/services/page.service";
import { assignEmployee, transferPage } from "@/server/services/assignment.service";
import { listRevenue, createRevenue, updateRevenue, softDeleteRevenue } from "@/server/services/revenue.service";
import { listAdExpenses, createAdExpense, updateAdExpense, softDeleteAdExpense } from "@/server/services/ads.service";
import {
  listAdminExpenses,
  createAdminExpense,
  updateAdminExpense,
  softDeleteAdminExpense,
} from "@/server/services/admin-expense.service";
import {
  listAdminReceipts,
  createAdminReceipt,
  updateAdminReceipt,
  softDeleteAdminReceipt,
} from "@/server/services/receipt.service";
import {
  listEmployeeReceipts,
  createEmployeeReceipt,
  updateEmployeeReceipt,
  softDeleteEmployeeReceipt,
} from "@/server/services/employee-receipt.service";
import {
  listPageStatusOptionsWithUsage,
  createPageStatusOption,
  updatePageStatusOption,
  deletePageStatusOption,
} from "@/server/services/page-status-option.service";
import { listAdminOptions } from "@/server/services/user-account.service";
import { listAuditLogs } from "@/server/services/audit.service";
import { parseMonthKey } from "@/lib/month";
import { currentDateKey } from "@/lib/dates";
import { PAGE_STATUS_COLORS } from "@/server/validators/page-status-option.schema";

const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Định dạng tháng phải là YYYY-MM")
  .optional();

const pageArgs = {
  page: z.number().int().min(1).optional(),
  pageSize: z.union([z.literal(20), z.literal(50), z.literal(100)]).optional(),
};

// Phase 16 write tools — same "YYYY-MM"/"YYYY-MM-DD" shapes as the Phase 15
// read tools above, just required instead of optional (a create/update always
// needs a month or date, a filter doesn't).
const requiredMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Định dạng tháng phải là YYYY-MM");
const requiredDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng ngày phải là YYYY-MM-DD");

// MCP transmits JSON, so money travels as a plain number (never a string form
// input, never a BigInt — JSON has no BigInt type) — converted to BigInt
// right before it reaches a service function, same "no floating point past
// this point" guarantee as `common.schema.ts`'s moneySchema for the Web forms.
const mcpAmountSchema = z.number().int().nonnegative({ error: "Số tiền phải là số nguyên >= 0." });

const mcpNoteSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((value) => (value ? value : undefined));

const emailSchema = z.string().trim().toLowerCase().pipe(z.email({ error: "Email không hợp lệ." }));

// spec §33 — destructive tools take an optional `confirm` so a missing/false
// value produces a clean {success:false,error:{code:"CONFIRMATION_REQUIRED"}}
// envelope (a business rule, not malformed input) instead of a raw MCP SDK
// inputSchema rejection, which never reaches the spec §34 envelope (see
// plan.md Phase 15 "Lỗi validate input...").
const confirmSchema = z.boolean().optional();

function requireConfirm(confirm: boolean | undefined): void {
  if (!confirm) {
    throw new McpToolError("Thao tác này yêu cầu xác nhận — gọi lại với confirm: true (spec §33).", "CONFIRMATION_REQUIRED");
  }
}

function requiredMonthToDate(month: string): Date {
  const parsed = parseMonthKey(month);
  if (!parsed) throw new McpToolError("Tháng không hợp lệ.", "INVALID_MONTH");
  return parsed;
}

/** Read-only for every Phase 15 tool — matches spec §32 "cung cấp các tool read-only trước". */
const READ_ONLY_ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;
/** Phase 16 write tools that aren't in the spec §33 destructive list (create/update/transfer/assign). */
const WRITE_ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, idempotentHint: false } as const;
/** spec §33 "MCP destructive action safety" — delete/deactivate, gated by `requireConfirm`. */
const DESTRUCTIVE_ANNOTATIONS = { readOnlyHint: false, destructiveHint: true, idempotentHint: false } as const;

/**
 * Per-request MCP server factory (spec §30/§31/§32/§34, plan.md Phase 15/16).
 * Every tool call runs through the same Service Layer as the Web app
 * (CLAUDE.md "Service Layer dùng chung") via `runMcpTool`, which also
 * produces the `{success,data,meta}` response envelope and the
 * `actor_type=MCP` Audit Log entry (spec §29) — no business logic lives
 * here, only input parsing + wiring to the existing services.
 *
 * `createdByAdminId` (Phase 16 — resolved once in `mcp/auth.ts` from
 * `McpClient.created_by_admin_id`) is threaded into every write tool below as
 * the `adminId` positional argument every Service Layer mutation function
 * expects — it fills business fields like `created_by_admin_id`/
 * `assigned_by_admin_id` (there's no "logged-in Admin" for an MCP call, so
 * this falls back to whichever Admin created the API key being used, same as
 * `paid_by_admin_id`/`received_by_admin_id` fall back to nothing — those stay
 * explicit tool inputs, matching the Web forms' own required "người chi"/
 * "người nhận" selects). The Audit Log actor is unaffected by this and is
 * always `actor_type=MCP` — see `auditActorFields` in `server/audit/log-action.ts`.
 */
export function buildMcpServer(mcpClientId: string, createdByAdminId: string): McpServer {
  const server = new McpServer({ name: "ocean-finance", version: "1.0.0" });
  const auditMeta = { actorMcpClientId: mcpClientId };

  server.registerTool(
    "get_dashboard",
    {
      title: "Xem KPI tổng quan hệ thống",
      description: "Doanh thu, chi phí, lợi nhuận toàn hệ thống theo tháng (bỏ trống `month` = toàn thời gian).",
      inputSchema: z.object({ month: monthSchema }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ month }) =>
      runMcpTool({
        mcpClientId,
        action: "READ",
        entityType: "Dashboard",
        run: async () => {
          const financials = await getSystemFinancials(month);
          return {
            totalRevenue: financials.totalPageRevenue,
            totalReceived: financials.totalReceived,
            totalExpenses: financials.totalExpenses,
            profit: financials.profit,
            totalSalary: financials.salaryCost,
            totalAds: financials.adsCost,
          };
        },
      }),
  );

  server.registerTool(
    "list_admins",
    {
      title: "Danh sách Admin",
      description:
        "Liệt kê mọi tài khoản Admin ({adminId, name}) — dùng để tra ra UUID trước khi gọi các tool cần `paidByAdminId`/`receivedByAdminId`/`createdByAdminId` (vd `set_employee_salary`, `create_ad_expense`, `create_admin_receipt`...), tránh phải dò qua các tool khác chỉ để tìm id theo tên Admin.",
      inputSchema: z.object({}),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () =>
      runMcpTool({ mcpClientId, action: "READ", entityType: "User", run: () => listAdminOptions() }),
  );

  server.registerTool(
    "list_employees",
    {
      title: "Danh sách nhân viên",
      description: "Liệt kê nhân viên — lọc theo tên/email (`search`), trạng thái, tháng (áp dụng cho Doanh thu/Tổng chi phí).",
      inputSchema: z.object({
        search: z.string().optional(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
        month: monthSchema,
        ...pageArgs,
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runMcpTool({ mcpClientId, action: "READ", entityType: "Employee", run: () => listEmployees(input) }),
  );

  server.registerTool(
    "get_employee_detail",
    {
      title: "Chi tiết nhân viên",
      description: "Thông tin + tài chính (doanh thu, chi phí) của một nhân viên, có thể lọc theo tháng.",
      inputSchema: z.object({ employeeId: z.uuid(), month: monthSchema }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ employeeId, month }) =>
      runMcpTool({
        mcpClientId,
        action: "READ",
        entityType: "Employee",
        entityId: employeeId,
        run: async () => {
          const detail = await getEmployeeDetail(employeeId);
          if (!detail) throw new McpToolError("Không tìm thấy nhân viên.", "EMPLOYEE_NOT_FOUND");
          const financials = await getEmployeeFinancials(employeeId, month);
          return { ...detail, ...financials };
        },
      }),
  );

  server.registerTool(
    "list_pages",
    {
      title: "Danh sách Page",
      description: "Liệt kê Page — lọc theo tên/URL (`search`), loại Page, trạng thái, nhân viên phụ trách hiện tại.",
      inputSchema: z.object({
        search: z.string().optional(),
        pageType: z.enum(["SYSTEM", "BKT"]).optional(),
        statusId: z.uuid().optional(),
        employeeId: z.uuid().optional(),
        ...pageArgs,
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) => runMcpTool({ mcpClientId, action: "READ", entityType: "Page", run: () => listPages(input) }),
  );

  server.registerTool(
    "get_page_detail",
    {
      title: "Chi tiết Page",
      description: "Thông tin chi tiết một Page: nhân viên phụ trách hiện tại, giá mua, trạng thái, người chi.",
      inputSchema: z.object({ pageId: z.uuid() }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ pageId }) =>
      runMcpTool({
        mcpClientId,
        action: "READ",
        entityType: "Page",
        entityId: pageId,
        run: async () => {
          const detail = await getPageDetail(pageId);
          if (!detail) throw new McpToolError("Không tìm thấy Page.", "PAGE_NOT_FOUND");
          return detail;
        },
      }),
  );

  server.registerTool(
    "list_revenue",
    {
      title: "Danh sách doanh thu",
      description: "Liệt kê Revenue theo Page — lọc theo tháng, nhân viên, Page, từ khoá.",
      inputSchema: z.object({
        month: monthSchema,
        employeeId: z.uuid().optional(),
        pageId: z.uuid().optional(),
        search: z.string().optional(),
        ...pageArgs,
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) => runMcpTool({ mcpClientId, action: "READ", entityType: "Revenue", run: () => listRevenue(input) }),
  );

  server.registerTool(
    "list_ads",
    {
      title: "Danh sách chi phí Ads",
      description: "Liệt kê AdExpense theo Page — lọc theo tháng, nhân viên, Page, từ khoá.",
      inputSchema: z.object({
        month: monthSchema,
        employeeId: z.uuid().optional(),
        pageId: z.uuid().optional(),
        search: z.string().optional(),
        ...pageArgs,
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runMcpTool({ mcpClientId, action: "READ", entityType: "AdExpense", run: () => listAdExpenses(input) }),
  );

  server.registerTool(
    "list_admin_expenses",
    {
      title: "Danh sách chi phí chung",
      description: "Liệt kê AdminExpense (chi phí chung, không gắn Page/nhân viên) — lọc theo tháng, người tạo.",
      inputSchema: z.object({
        month: monthSchema,
        createdByAdminId: z.uuid().optional(),
        ...pageArgs,
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runMcpTool({ mcpClientId, action: "READ", entityType: "AdminExpense", run: () => listAdminExpenses(input) }),
  );

  server.registerTool(
    "list_admin_receipts",
    {
      title: "Danh sách tiền Admin đã nhận",
      description: "Liệt kê AdminReceipt (tiền Admin thực nhận, tách biệt với Page Revenue) — lọc theo tháng, người tạo.",
      inputSchema: z.object({
        month: monthSchema,
        createdByAdminId: z.uuid().optional(),
        ...pageArgs,
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runMcpTool({ mcpClientId, action: "READ", entityType: "AdminReceipt", run: () => listAdminReceipts(input) }),
  );

  server.registerTool(
    "list_employee_receipts",
    {
      title: "Danh sách tiền nhân viên đã nhận",
      description:
        "Liệt kê EmployeeReceipt (tiền nhân viên THỰC NHẬN, spec §20a) — thuần bản ghi để xem, không cộng vào Employee Cost/Revenue hay bất kỳ công thức tài chính nào khác. Lọc theo tháng, nhân viên.",
      inputSchema: z.object({
        month: monthSchema,
        employeeId: z.uuid().optional(),
        ...pageArgs,
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runMcpTool({
        mcpClientId,
        action: "READ",
        entityType: "EmployeeReceipt",
        run: () => listEmployeeReceipts(input),
      }),
  );

  server.registerTool(
    "list_page_status_options",
    {
      title: "Danh sách loại trạng thái Page",
      description: "Liệt kê PageStatusOption (nhãn trạng thái Page do Admin định nghĩa, spec §15.3) kèm số Page đang dùng mỗi loại.",
      inputSchema: z.object({}),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () =>
      runMcpTool({
        mcpClientId,
        action: "READ",
        entityType: "PageStatusOption",
        run: () => listPageStatusOptionsWithUsage(),
      }),
  );

  server.registerTool(
    "search_audit_logs",
    {
      title: "Tra cứu Audit Log",
      description: "Tìm kiếm nhật ký thao tác (Web + MCP) — lọc theo loại đối tượng, hành động, người thực hiện, entity_id, khoảng ngày.",
      inputSchema: z.object({
        entityType: z.string().optional(),
        action: z.string().optional(),
        actorUserId: z.uuid().optional(),
        entityId: z.uuid().optional(),
        dateFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng ngày phải là YYYY-MM-DD")
          .optional(),
        dateTo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng ngày phải là YYYY-MM-DD")
          .optional(),
        ...pageArgs,
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runMcpTool({ mcpClientId, action: "READ", entityType: "AuditLog", run: () => listAuditLogs(input) }),
  );

  // ---------------------------------------------------------------------
  // Phase 16 write tools (spec §32 create/update/delete/transfer/archive/
  // deactivate, §33 destructive safety) — same Service Layer as Web,
  // `auditOnSuccess: false` because those services already write their own
  // richer AuditLog entry (see `runMcpTool` doc comment and `auditActorFields`).
  // ---------------------------------------------------------------------

  server.registerTool(
    "create_employee",
    {
      title: "Tạo nhân viên",
      description:
        "Tạo tài khoản nhân viên mới (User role=USER + EmployeeProfile) — chưa có mức lương, đặt qua `set_employee_salary`. Trả về mật khẩu tạm đúng một lần.",
      inputSchema: z.object({
        name: z.string().trim().min(1),
        email: emailSchema,
        status: z.enum(["ACTIVE", "INACTIVE"]),
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ name, email, status }) =>
      runMcpTool({
        mcpClientId,
        action: "CREATE",
        entityType: "Employee",
        auditOnSuccess: false,
        run: () => createEmployee({ name, email, status }, createdByAdminId, auditMeta),
      }),
  );

  server.registerTool(
    "update_employee",
    {
      title: "Cập nhật nhân viên",
      description: "Sửa tên/email/trạng thái nhân viên.",
      inputSchema: z.object({
        employeeId: z.uuid(),
        name: z.string().trim().min(1),
        email: emailSchema,
        status: z.enum(["ACTIVE", "INACTIVE"]),
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ employeeId, name, email, status }) =>
      runMcpTool({
        mcpClientId,
        action: "UPDATE",
        entityType: "Employee",
        entityId: employeeId,
        auditOnSuccess: false,
        run: () => updateEmployee(employeeId, { name, email, status }, createdByAdminId, auditMeta),
      }),
  );

  server.registerTool(
    "set_employee_salary",
    {
      title: "Đổi lương nhân viên",
      description:
        "Đặt mức lương hiện tại — luôn hiệu lực ngay từ hôm nay (không chọn ngày khác), tự đóng SalaryHistory đang active.",
      inputSchema: z.object({
        employeeId: z.uuid(),
        monthlySalary: mcpAmountSchema,
        paidByAdminId: z.uuid(),
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ employeeId, monthlySalary, paidByAdminId }) =>
      runMcpTool({
        mcpClientId,
        action: "CHANGE_SALARY",
        entityType: "SalaryHistory",
        entityId: employeeId,
        auditOnSuccess: false,
        run: () =>
          setEmployeeSalary(
            employeeId,
            { monthlySalary: BigInt(monthlySalary), effectiveFrom: new Date(currentDateKey()), paidByAdminId },
            createdByAdminId,
            auditMeta,
          ),
      }),
  );

  server.registerTool(
    "deactivate_employee",
    {
      title: "Vô hiệu hoá nhân viên",
      description: "Đặt trạng thái INACTIVE — không xoá lịch sử. Destructive action, yêu cầu confirm:true (spec §33).",
      inputSchema: z.object({ employeeId: z.uuid(), confirm: confirmSchema }),
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ employeeId, confirm }) =>
      runMcpTool({
        mcpClientId,
        action: "DEACTIVATE",
        entityType: "Employee",
        entityId: employeeId,
        auditOnSuccess: false,
        run: async () => {
          requireConfirm(confirm);
          await deactivateEmployee(employeeId, createdByAdminId, auditMeta);
          return { employeeId, status: "INACTIVE" };
        },
      }),
  );

  server.registerTool(
    "create_page",
    {
      title: "Tạo Page",
      description:
        "Tạo Page mới (loại BKT — Page hệ thống chỉ tự tạo qua User). Nếu có `employeeId` sẽ gán ngay + tạo Page Purchase Expense khi `purchasePrice > 0` (bắt buộc `paidByAdminId` trong trường hợp đó, dù đã gán nhân viên hay chưa).",
      inputSchema: z.object({
        name: z.string().trim().min(1),
        facebookUrl: z.url(),
        purchasePrice: mcpAmountSchema,
        purchaseMonth: requiredMonthSchema,
        paidByAdminId: z.uuid().optional(),
        employeeId: z.uuid().optional(),
        notes: mcpNoteSchema,
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ name, facebookUrl, purchasePrice, purchaseMonth, paidByAdminId, employeeId, notes }) =>
      runMcpTool({
        mcpClientId,
        action: "CREATE",
        entityType: "Page",
        auditOnSuccess: false,
        run: () =>
          createPage(
            {
              name,
              facebookUrl,
              purchasePrice: BigInt(purchasePrice),
              purchaseMonth: requiredMonthToDate(purchaseMonth),
              assignEmployeeId: employeeId,
              paidByAdminId,
              notes,
            },
            createdByAdminId,
            auditMeta,
          ),
      }),
  );

  server.registerTool(
    "update_page",
    {
      title: "Cập nhật Page",
      description: "Sửa tên/URL/ghi chú/tag trạng thái — đổi nhân viên phụ trách dùng `transfer_page`/`assign_employee`.",
      inputSchema: z.object({
        pageId: z.uuid(),
        name: z.string().trim().min(1),
        facebookUrl: z.url(),
        statusIds: z.array(z.uuid()).optional(),
        notes: mcpNoteSchema,
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ pageId, name, facebookUrl, statusIds, notes }) =>
      runMcpTool({
        mcpClientId,
        action: "UPDATE",
        entityType: "Page",
        entityId: pageId,
        auditOnSuccess: false,
        run: () => updatePage(pageId, { name, facebookUrl, statusIds, notes }, createdByAdminId, auditMeta),
      }),
  );

  server.registerTool(
    "transfer_page",
    {
      title: "Chuyển giao Page",
      description:
        "Đóng PageAssignment đang active, mở assignment mới cho nhân viên khác — không đổi Revenue/AdExpense/PagePurchaseExpense đã có (snapshot, spec §15.4).",
      inputSchema: z.object({
        pageId: z.uuid(),
        newEmployeeId: z.uuid(),
        effectiveDate: requiredDateSchema,
        note: mcpNoteSchema,
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ pageId, newEmployeeId, effectiveDate, note }) =>
      runMcpTool({
        mcpClientId,
        action: "TRANSFER",
        entityType: "Page",
        entityId: pageId,
        auditOnSuccess: false,
        run: () =>
          transferPage(pageId, { newEmployeeId, effectiveDate: new Date(effectiveDate), note }, createdByAdminId, auditMeta),
      }),
  );

  server.registerTool(
    "assign_employee",
    {
      title: "Gán nhân viên lần đầu",
      description:
        "Gán nhân viên cho Page hiện chưa có ai phụ trách — khác `transfer_page` ở chỗ không cần đóng assignment cũ (spec §15.4a).",
      inputSchema: z.object({
        pageId: z.uuid(),
        employeeId: z.uuid(),
        effectiveDate: requiredDateSchema,
        note: mcpNoteSchema,
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ pageId, employeeId, effectiveDate, note }) =>
      runMcpTool({
        mcpClientId,
        action: "ASSIGN",
        entityType: "Page",
        entityId: pageId,
        auditOnSuccess: false,
        run: () =>
          assignEmployee(pageId, { employeeId, effectiveDate: new Date(effectiveDate), note }, createdByAdminId, auditMeta),
      }),
  );

  server.registerTool(
    "delete_page",
    {
      title: "Xoá Page",
      description:
        "Soft delete (spec §15.5) — ẩn khỏi danh sách, giữ nguyên lịch sử Revenue/AdExpense/PagePurchaseExpense/PageAssignment. Destructive action, yêu cầu confirm:true (spec §33).",
      inputSchema: z.object({ pageId: z.uuid(), confirm: confirmSchema }),
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ pageId, confirm }) =>
      runMcpTool({
        mcpClientId,
        action: "DELETE",
        entityType: "Page",
        entityId: pageId,
        auditOnSuccess: false,
        run: async () => {
          requireConfirm(confirm);
          await softDeletePage(pageId, createdByAdminId, auditMeta);
          return { pageId, deleted: true };
        },
      }),
  );

  server.registerTool(
    "create_revenue",
    {
      title: "Nhập doanh thu",
      description:
        "Nhập doanh thu Page theo tháng — nhân viên tự resolve từ PageAssignment (spec §4.1/§17). Nhập lại cho cùng Page+tháng sẽ ghi đè số tiền/ghi chú, không tạo trùng.",
      inputSchema: z.object({
        pageId: z.uuid(),
        revenueMonth: requiredMonthSchema,
        amount: mcpAmountSchema,
        note: mcpNoteSchema,
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ pageId, revenueMonth, amount, note }) =>
      runMcpTool({
        mcpClientId,
        action: "CREATE",
        entityType: "Revenue",
        auditOnSuccess: false,
        run: () =>
          createRevenue(
            { pageId, revenueMonth: requiredMonthToDate(revenueMonth), amount: BigInt(amount), note },
            createdByAdminId,
            auditMeta,
          ),
      }),
  );

  server.registerTool(
    "update_revenue",
    {
      title: "Sửa doanh thu",
      description: "Đổi Page/tháng/số tiền/ghi chú — đổi Page hoặc tháng sẽ resolve lại nhân viên snapshot.",
      inputSchema: z.object({
        revenueId: z.uuid(),
        pageId: z.uuid(),
        revenueMonth: requiredMonthSchema,
        amount: mcpAmountSchema,
        note: mcpNoteSchema,
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ revenueId, pageId, revenueMonth, amount, note }) =>
      runMcpTool({
        mcpClientId,
        action: "UPDATE",
        entityType: "Revenue",
        entityId: revenueId,
        auditOnSuccess: false,
        run: () =>
          updateRevenue(
            revenueId,
            { pageId, revenueMonth: requiredMonthToDate(revenueMonth), amount: BigInt(amount), note },
            createdByAdminId,
            auditMeta,
          ),
      }),
  );

  server.registerTool(
    "delete_revenue",
    {
      title: "Xoá doanh thu",
      description: "Soft delete. Destructive action, yêu cầu confirm:true (spec §33).",
      inputSchema: z.object({ revenueId: z.uuid(), confirm: confirmSchema }),
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ revenueId, confirm }) =>
      runMcpTool({
        mcpClientId,
        action: "DELETE",
        entityType: "Revenue",
        entityId: revenueId,
        auditOnSuccess: false,
        run: async () => {
          requireConfirm(confirm);
          await softDeleteRevenue(revenueId, createdByAdminId, auditMeta);
          return { revenueId, deleted: true };
        },
      }),
  );

  server.registerTool(
    "create_ad_expense",
    {
      title: "Nhập chi phí Ads",
      description:
        "Nhập chi phí Ads theo Page + tháng — nhân viên tự resolve theo owner vào ngày 1 của tháng (spec §6/§18). Mỗi Page tối đa 1 record/tháng, nhập lại ghi đè.",
      inputSchema: z.object({
        pageId: z.uuid(),
        expenseMonth: requiredMonthSchema,
        amount: mcpAmountSchema,
        note: mcpNoteSchema,
        paidByAdminId: z.uuid(),
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ pageId, expenseMonth, amount, note, paidByAdminId }) =>
      runMcpTool({
        mcpClientId,
        action: "CREATE",
        entityType: "AdExpense",
        auditOnSuccess: false,
        run: () =>
          createAdExpense(
            { pageId, expenseMonth: requiredMonthToDate(expenseMonth), amount: BigInt(amount), note, paidByAdminId },
            createdByAdminId,
            auditMeta,
          ),
      }),
  );

  server.registerTool(
    "update_ad_expense",
    {
      title: "Sửa chi phí Ads",
      description: "Đổi Page/tháng/số tiền/ghi chú/người chi — đổi Page hoặc tháng sẽ resolve lại nhân viên snapshot.",
      inputSchema: z.object({
        adExpenseId: z.uuid(),
        pageId: z.uuid(),
        expenseMonth: requiredMonthSchema,
        amount: mcpAmountSchema,
        note: mcpNoteSchema,
        paidByAdminId: z.uuid(),
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ adExpenseId, pageId, expenseMonth, amount, note, paidByAdminId }) =>
      runMcpTool({
        mcpClientId,
        action: "UPDATE",
        entityType: "AdExpense",
        entityId: adExpenseId,
        auditOnSuccess: false,
        run: () =>
          updateAdExpense(
            adExpenseId,
            { pageId, expenseMonth: requiredMonthToDate(expenseMonth), amount: BigInt(amount), note, paidByAdminId },
            createdByAdminId,
            auditMeta,
          ),
      }),
  );

  server.registerTool(
    "delete_ad_expense",
    {
      title: "Xoá chi phí Ads",
      description: "Soft delete. Destructive action, yêu cầu confirm:true (spec §33).",
      inputSchema: z.object({ adExpenseId: z.uuid(), confirm: confirmSchema }),
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ adExpenseId, confirm }) =>
      runMcpTool({
        mcpClientId,
        action: "DELETE",
        entityType: "AdExpense",
        entityId: adExpenseId,
        auditOnSuccess: false,
        run: async () => {
          requireConfirm(confirm);
          await softDeleteAdExpense(adExpenseId, createdByAdminId, auditMeta);
          return { adExpenseId, deleted: true };
        },
      }),
  );

  server.registerTool(
    "create_admin_expense",
    {
      title: "Nhập chi phí chung",
      description: "Nhập chi phí chung không gắn Page/nhân viên (tool, server, văn phòng...).",
      inputSchema: z.object({
        expenseDate: requiredDateSchema,
        amount: mcpAmountSchema,
        description: z.string().trim().min(1).max(500),
        note: mcpNoteSchema,
        paidByAdminId: z.uuid(),
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ expenseDate, amount, description, note, paidByAdminId }) =>
      runMcpTool({
        mcpClientId,
        action: "CREATE",
        entityType: "AdminExpense",
        auditOnSuccess: false,
        run: () =>
          createAdminExpense(
            { expenseDate: new Date(expenseDate), amount: BigInt(amount), description, note, paidByAdminId },
            createdByAdminId,
            auditMeta,
          ),
      }),
  );

  server.registerTool(
    "update_admin_expense",
    {
      title: "Sửa chi phí chung",
      description: "Sửa ngày/số tiền/nội dung/ghi chú/người chi của một khoản chi phí chung.",
      inputSchema: z.object({
        adminExpenseId: z.uuid(),
        expenseDate: requiredDateSchema,
        amount: mcpAmountSchema,
        description: z.string().trim().min(1).max(500),
        note: mcpNoteSchema,
        paidByAdminId: z.uuid(),
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ adminExpenseId, expenseDate, amount, description, note, paidByAdminId }) =>
      runMcpTool({
        mcpClientId,
        action: "UPDATE",
        entityType: "AdminExpense",
        entityId: adminExpenseId,
        auditOnSuccess: false,
        run: () =>
          updateAdminExpense(
            adminExpenseId,
            { expenseDate: new Date(expenseDate), amount: BigInt(amount), description, note, paidByAdminId },
            createdByAdminId,
            auditMeta,
          ),
      }),
  );

  server.registerTool(
    "delete_admin_expense",
    {
      title: "Xoá chi phí chung",
      description: "Soft delete. Destructive action, yêu cầu confirm:true (spec §33).",
      inputSchema: z.object({ adminExpenseId: z.uuid(), confirm: confirmSchema }),
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ adminExpenseId, confirm }) =>
      runMcpTool({
        mcpClientId,
        action: "DELETE",
        entityType: "AdminExpense",
        entityId: adminExpenseId,
        auditOnSuccess: false,
        run: async () => {
          requireConfirm(confirm);
          await softDeleteAdminExpense(adminExpenseId, createdByAdminId, auditMeta);
          return { adminExpenseId, deleted: true };
        },
      }),
  );

  server.registerTool(
    "create_admin_receipt",
    {
      title: "Nhập tiền Admin đã nhận",
      description: "Ghi nhận khoản tiền Admin thực nhận theo tháng — tách biệt hoàn toàn với Page Revenue (spec §9/§10.4).",
      inputSchema: z.object({
        receiptMonth: requiredMonthSchema,
        amount: mcpAmountSchema,
        source: z.string().trim().min(1).max(500),
        note: mcpNoteSchema,
        receivedByAdminId: z.uuid(),
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ receiptMonth, amount, source, note, receivedByAdminId }) =>
      runMcpTool({
        mcpClientId,
        action: "CREATE",
        entityType: "AdminReceipt",
        auditOnSuccess: false,
        run: () =>
          createAdminReceipt(
            { receiptMonth: requiredMonthToDate(receiptMonth), amount: BigInt(amount), source, note, receivedByAdminId },
            createdByAdminId,
            auditMeta,
          ),
      }),
  );

  server.registerTool(
    "update_admin_receipt",
    {
      title: "Sửa tiền Admin đã nhận",
      description: "Sửa tháng/số tiền/nguồn/ghi chú/admin nhận của một khoản đã ghi nhận.",
      inputSchema: z.object({
        adminReceiptId: z.uuid(),
        receiptMonth: requiredMonthSchema,
        amount: mcpAmountSchema,
        source: z.string().trim().min(1).max(500),
        note: mcpNoteSchema,
        receivedByAdminId: z.uuid(),
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ adminReceiptId, receiptMonth, amount, source, note, receivedByAdminId }) =>
      runMcpTool({
        mcpClientId,
        action: "UPDATE",
        entityType: "AdminReceipt",
        entityId: adminReceiptId,
        auditOnSuccess: false,
        run: () =>
          updateAdminReceipt(
            adminReceiptId,
            { receiptMonth: requiredMonthToDate(receiptMonth), amount: BigInt(amount), source, note, receivedByAdminId },
            createdByAdminId,
            auditMeta,
          ),
      }),
  );

  server.registerTool(
    "delete_admin_receipt",
    {
      title: "Xoá tiền Admin đã nhận",
      description: "Soft delete. Destructive action, yêu cầu confirm:true (spec §33).",
      inputSchema: z.object({ adminReceiptId: z.uuid(), confirm: confirmSchema }),
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ adminReceiptId, confirm }) =>
      runMcpTool({
        mcpClientId,
        action: "DELETE",
        entityType: "AdminReceipt",
        entityId: adminReceiptId,
        auditOnSuccess: false,
        run: async () => {
          requireConfirm(confirm);
          await softDeleteAdminReceipt(adminReceiptId, createdByAdminId, auditMeta);
          return { adminReceiptId, deleted: true };
        },
      }),
  );

  // ---------------------------------------------------------------------
  // EmployeeReceipt (spec §20a) + PageStatusOption (spec §15.3) write tools
  // — added 2026-08-20: both entities shipped full CRUD in the Web app
  // (Phase 13.1/13.2) before the original Phase 16 write-tool sweep, which
  // only covered spec §32's original entity list and missed these two (no
  // "deliberate exclusion" note exists for either, unlike EmployeeProfitSettlement
  // — see plan.md). Same Service Layer, same runMcpTool/confirm pattern as
  // every tool above.
  // ---------------------------------------------------------------------

  server.registerTool(
    "create_employee_receipt",
    {
      title: "Ghi nhận tiền nhân viên đã nhận",
      description:
        "Ghi nhận khoản tiền nhân viên THỰC NHẬN theo tháng (spec §20a) — thuần bản ghi để xem, không cộng vào Employee Cost/Revenue. Nhập lại cho cùng nhân viên+tháng sẽ ghi đè số tiền/ghi chú, không tạo trùng.",
      inputSchema: z.object({
        employeeId: z.uuid(),
        receiptMonth: requiredMonthSchema,
        amount: mcpAmountSchema,
        note: mcpNoteSchema,
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ employeeId, receiptMonth, amount, note }) =>
      runMcpTool({
        mcpClientId,
        action: "CREATE",
        entityType: "EmployeeReceipt",
        auditOnSuccess: false,
        run: () =>
          createEmployeeReceipt(
            { employeeId, receiptMonth: requiredMonthToDate(receiptMonth), amount: BigInt(amount), note },
            createdByAdminId,
            auditMeta,
          ),
      }),
  );

  server.registerTool(
    "update_employee_receipt",
    {
      title: "Sửa tiền nhân viên đã nhận",
      description: "Đổi nhân viên/tháng/số tiền/ghi chú của một khoản đã ghi nhận.",
      inputSchema: z.object({
        employeeReceiptId: z.uuid(),
        employeeId: z.uuid(),
        receiptMonth: requiredMonthSchema,
        amount: mcpAmountSchema,
        note: mcpNoteSchema,
      }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ employeeReceiptId, employeeId, receiptMonth, amount, note }) =>
      runMcpTool({
        mcpClientId,
        action: "UPDATE",
        entityType: "EmployeeReceipt",
        entityId: employeeReceiptId,
        auditOnSuccess: false,
        run: () =>
          updateEmployeeReceipt(
            employeeReceiptId,
            { employeeId, receiptMonth: requiredMonthToDate(receiptMonth), amount: BigInt(amount), note },
            createdByAdminId,
            auditMeta,
          ),
      }),
  );

  server.registerTool(
    "delete_employee_receipt",
    {
      title: "Xoá tiền nhân viên đã nhận",
      description: "Soft delete. Destructive action, yêu cầu confirm:true (spec §33).",
      inputSchema: z.object({ employeeReceiptId: z.uuid(), confirm: confirmSchema }),
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ employeeReceiptId, confirm }) =>
      runMcpTool({
        mcpClientId,
        action: "DELETE",
        entityType: "EmployeeReceipt",
        entityId: employeeReceiptId,
        auditOnSuccess: false,
        run: async () => {
          requireConfirm(confirm);
          await softDeleteEmployeeReceipt(employeeReceiptId, createdByAdminId, auditMeta);
          return { employeeReceiptId, deleted: true };
        },
      }),
  );

  const pageStatusColorSchema = z.enum(PAGE_STATUS_COLORS, { error: "Màu không hợp lệ." });
  const pageStatusLabelSchema = z.string().trim().min(1).max(30, { error: "Tên tối đa 30 ký tự." });

  server.registerTool(
    "create_page_status_option",
    {
      title: "Tạo loại trạng thái Page",
      description: "Tạo một nhãn trạng thái mới cho Page (Cài đặt → Loại trạng thái Page, spec §15.3) — màu chỉ nhận preset swatch, không phải hex tự do.",
      inputSchema: z.object({ label: pageStatusLabelSchema, color: pageStatusColorSchema }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ label, color }) =>
      runMcpTool({
        mcpClientId,
        action: "CREATE",
        entityType: "PageStatusOption",
        auditOnSuccess: false,
        run: () => createPageStatusOption({ label, color }, createdByAdminId, auditMeta),
      }),
  );

  server.registerTool(
    "update_page_status_option",
    {
      title: "Sửa loại trạng thái Page",
      description: "Đổi tên/màu một loại trạng thái Page đã có.",
      inputSchema: z.object({ optionId: z.uuid(), label: pageStatusLabelSchema, color: pageStatusColorSchema }),
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ optionId, label, color }) =>
      runMcpTool({
        mcpClientId,
        action: "UPDATE",
        entityType: "PageStatusOption",
        entityId: optionId,
        auditOnSuccess: false,
        run: () => updatePageStatusOption(optionId, { label, color }, createdByAdminId, auditMeta),
      }),
  );

  server.registerTool(
    "delete_page_status_option",
    {
      title: "Xoá loại trạng thái Page",
      description:
        "Hard delete — khác mọi entity khác trong bộ tool này (đây là metadata hiển thị thuần tuý, không phải dữ liệu tài chính, xem schema.md). Page đang gắn nhãn này tự mất đúng nhãn đó (ON DELETE CASCADE), không mất nhãn khác. Destructive action, yêu cầu confirm:true (spec §33).",
      inputSchema: z.object({ optionId: z.uuid(), confirm: confirmSchema }),
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ optionId, confirm }) =>
      runMcpTool({
        mcpClientId,
        action: "DELETE",
        entityType: "PageStatusOption",
        entityId: optionId,
        auditOnSuccess: false,
        run: async () => {
          requireConfirm(confirm);
          await deletePageStatusOption(optionId, createdByAdminId, auditMeta);
          return { optionId, deleted: true };
        },
      }),
  );

  return server;
}
