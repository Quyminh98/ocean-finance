"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteEmployeeReceiptAction } from "@/server/actions/employee-receipt.actions";

type DeleteEmployeeReceiptButtonProps = {
  employeeReceiptId: string;
};

export function DeleteEmployeeReceiptButton({ employeeReceiptId }: DeleteEmployeeReceiptButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 className="size-3.5" strokeWidth={2} />
          Xoá
        </Button>
      }
      title="Xoá khoản đã nhận"
      description="Bản ghi sẽ bị ẩn khỏi danh sách nhưng vẫn được lưu (soft delete), không mất dữ liệu."
      confirmLabel="Xoá"
      onConfirm={() => deleteEmployeeReceiptAction(employeeReceiptId)}
    />
  );
}
