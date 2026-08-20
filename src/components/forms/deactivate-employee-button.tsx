"use client";

import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deactivateEmployeeAction } from "@/server/actions/employee.actions";

type DeactivateEmployeeButtonProps = {
  employeeId: string;
  employeeName: string;
};

export function DeactivateEmployeeButton({ employeeId, employeeName }: DeactivateEmployeeButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <UserX className="size-3.5" strokeWidth={2} />
          Vô hiệu hoá
        </Button>
      }
      title="Vô hiệu hoá nhân viên"
      description={`${employeeName} sẽ không thể đăng nhập được nữa. Toàn bộ lịch sử Page/Doanh thu/Chi phí vẫn được giữ nguyên.`}
      confirmLabel="Vô hiệu hoá"
      onConfirm={() => deactivateEmployeeAction(employeeId)}
    />
  );
}
