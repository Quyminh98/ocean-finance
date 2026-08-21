"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteAdExpenseAction } from "@/server/actions/ads.actions";

type DeleteAdExpenseButtonProps = {
  adExpenseId: string;
  employeeId: string;
};

export function DeleteAdExpenseButton({ adExpenseId, employeeId }: DeleteAdExpenseButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 className="size-3.5" strokeWidth={2} />
          Xoá
        </Button>
      }
      title="Xoá chi phí Ads"
      description="Bản ghi sẽ bị ẩn khỏi danh sách nhưng vẫn được lưu (soft delete), không mất dữ liệu."
      confirmLabel="Xoá"
      onConfirm={() => deleteAdExpenseAction(adExpenseId, employeeId)}
    />
  );
}
