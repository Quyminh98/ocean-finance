import { prisma } from "@/lib/db";
import { logAction, auditActorFields } from "@/server/audit/log-action";
import { getEmployeeFinancials } from "@/server/services/employee.service";

export class ProfitSettlementError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export type AuditMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
  actorMcpClientId?: string | null;
};

export type ProfitSettlementRow = {
  id: string;
  amount: bigint;
  note: string | null;
  createdAt: Date;
};

/**
 * Every active settlement for an employee, newest first — feeds the
 * "Bù chi phí" rows in Employee Detail's/User Costs' "Chi tiết chi phí"
 * table (user request 2026-08-19: settlements are now a genuine Employee
 * Cost component, see `EmployeeFinancials.profitSettlementCost` in
 * `employee.service.ts` — no longer "purely internal" as first designed).
 */
export async function listProfitSettlements(employeeId: string): Promise<ProfitSettlementRow[]> {
  const rows = await prisma.employeeProfitSettlement.findMany({
    where: { employeeId, deletedAt: null },
    select: { id: true, amount: true, note: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return rows;
}

/**
 * "Chốt về 0" — records the employee's current unsettled profit
 * (`Revenue − Cost`, where Cost already includes every past settlement) as
 * a new settlement, which immediately becomes part of Cost too — so the
 * next `getEmployeeFinancials` call nets the running profit back to 0.
 * Rejects when there's nothing positive to settle.
 */
export async function settleEmployeeProfit(
  employeeId: string,
  adminId: string,
  meta: AuditMeta = {},
): Promise<{ amount: bigint }> {
  const financials = await getEmployeeFinancials(employeeId);
  const currentProfit = financials.revenue - financials.totalCost;
  if (currentProfit <= 0n) {
    throw new ProfitSettlementError("Nhân viên này không có lợi nhuận dương để chốt.", "NO_POSITIVE_PROFIT");
  }

  const settlement = await prisma.employeeProfitSettlement.create({
    data: { employeeId, amount: currentProfit, createdByAdminId: adminId },
  });

  await logAction({
    ...auditActorFields(adminId, meta),
    action: "SETTLE",
    entityType: "EmployeeProfitSettlement",
    entityId: settlement.id,
    afterJson: { employeeId, amount: currentProfit.toString() },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { amount: currentProfit };
}
