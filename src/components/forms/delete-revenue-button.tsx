"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteRevenueAction } from "@/server/actions/revenue.actions";

type DeleteRevenueButtonProps = {
  revenueId: string;
  pageId: string;
};

export function DeleteRevenueButton({ revenueId, pageId }: DeleteRevenueButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 className="size-3.5" strokeWidth={2} />
          Xoá
        </Button>
      }
      title="Xoá doanh thu"
      description="Bản ghi sẽ bị ẩn khỏi danh sách nhưng vẫn được lưu (soft delete), không mất dữ liệu."
      confirmLabel="Xoá"
      onConfirm={() => deleteRevenueAction(revenueId, pageId)}
    />
  );
}
