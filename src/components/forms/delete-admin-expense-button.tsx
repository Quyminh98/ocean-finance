"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteAdminExpenseAction } from "@/server/actions/admin-expense.actions";

type DeleteAdminExpenseButtonProps = {
  adminExpenseId: string;
};

export function DeleteAdminExpenseButton({ adminExpenseId }: DeleteAdminExpenseButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 className="size-3.5" strokeWidth={2} />
          Xoá
        </Button>
      }
      title="Xoá chi phí"
      description="Bản ghi sẽ bị ẩn khỏi danh sách nhưng vẫn được lưu (soft delete) — có thể khôi phục sau qua mục “Xem đã xoá”."
      confirmLabel="Xoá"
      onConfirm={() => deleteAdminExpenseAction(adminExpenseId)}
    />
  );
}
