"use client";

import { TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { settleEmployeeProfitAction } from "@/server/actions/profit-settlement.actions";
import { formatVnd } from "@/lib/money";

type SettleProfitButtonProps = {
  employeeId: string;
  employeeName: string;
  currentProfit: bigint;
};

export function SettleProfitButton({ employeeId, employeeName, currentProfit }: SettleProfitButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <TrendingDown className="size-3.5" strokeWidth={2} />
          Chốt về 0
        </Button>
      }
      title="Chốt lợi nhuận về 0"
      description={`Ghi nhận ${formatVnd(currentProfit)} như một khoản chi phí riêng cho ${employeeName}, đưa lợi nhuận đang theo dõi của nhân viên này về 0. Không ảnh hưởng Tổng chi phí/Lợi nhuận hệ thống.`}
      confirmLabel="Chốt về 0"
      destructive={false}
      onConfirm={() => settleEmployeeProfitAction(employeeId)}
    />
  );
}
