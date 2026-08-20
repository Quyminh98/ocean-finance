// Vietnamese display labels for AuditLog.action/entity_type (spec §29 free-form
// strings). Falls back to the raw value for anything not listed here, so a
// new action/entity_type introduced by a later phase (e.g. Phase 13 "User
// role/status changes") still renders instead of disappearing.

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Tạo mới",
  UPDATE: "Cập nhật",
  DELETE: "Xoá",
  RESTORE: "Khôi phục",
  TRANSFER: "Chuyển giao",
  ASSIGN: "Gán nhân viên",
  CHANGE_SALARY: "Đổi lương",
  DEACTIVATE: "Vô hiệu hoá",
  ACTIVATE: "Kích hoạt",
  REVOKE: "Thu hồi",
  LOGIN: "Đăng nhập",
  LOGOUT: "Đăng xuất",
  READ: "Đọc dữ liệu (MCP)",
  SETTLE: "Chốt lợi nhuận",
};

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export type AuditTone = "success" | "info" | "error" | "neutral";

const ACTION_TONES: Record<string, AuditTone> = {
  CREATE: "success",
  RESTORE: "success",
  UPDATE: "info",
  TRANSFER: "info",
  ASSIGN: "info",
  CHANGE_SALARY: "info",
  DELETE: "error",
  DEACTIVATE: "error",
  REVOKE: "error",
  ACTIVATE: "success",
  LOGIN: "neutral",
  LOGOUT: "neutral",
  READ: "neutral",
  SETTLE: "info",
};

export function auditActionTone(action: string): AuditTone {
  return ACTION_TONES[action] ?? "neutral";
}

const ENTITY_LABELS: Record<string, string> = {
  Page: "Trang",
  Employee: "Nhân viên",
  Revenue: "Doanh thu",
  AdExpense: "Chi phí Ads",
  AdminExpense: "Tài nguyên",
  AdminReceipt: "Tiền Admin nhận",
  EmployeeReceipt: "Tiền nhân viên đã nhận",
  EmployeeProfitSettlement: "Chốt lợi nhuận nhân viên",
  ExpenseCategory: "Danh mục chi phí",
  PageStatusOption: "Loại trạng thái Page",
  SalaryHistory: "Lịch sử lương",
  User: "Tài khoản",
  McpClient: "MCP Client",
  Dashboard: "Bảng điều khiển",
  AuditLog: "Nhật ký",
};

export function auditEntityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}
