"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteAdminReceiptAction } from "@/server/actions/admin-receipt.actions";

type DeleteAdminReceiptButtonProps = {
  adminReceiptId: string;
};

export function DeleteAdminReceiptButton({ adminReceiptId }: DeleteAdminReceiptButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 className="size-3.5" strokeWidth={2} />
          Xoá
        </Button>
      }
      title="Xoá khoản nhận"
      description="Bản ghi sẽ bị ẩn khỏi danh sách nhưng vẫn được lưu (soft delete)."
      confirmLabel="Xoá"
      onConfirm={() => deleteAdminReceiptAction(adminReceiptId)}
    />
  );
}
