"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { restoreAdminExpenseAction } from "@/server/actions/admin-expense.actions";

type RestoreAdminExpenseButtonProps = {
  adminExpenseId: string;
};

/** First "Restore" action in the codebase (spec §19 "Restore nếu cần") — reuses `ConfirmDialog` non-destructive. */
export function RestoreAdminExpenseButton({ adminExpenseId }: RestoreAdminExpenseButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <RotateCcw className="size-3.5" strokeWidth={2} />
          Khôi phục
        </Button>
      }
      title="Khôi phục chi phí"
      description="Bản ghi sẽ xuất hiện lại trong danh sách chi phí đang hoạt động."
      confirmLabel="Khôi phục"
      destructive={false}
      onConfirm={() => restoreAdminExpenseAction(adminExpenseId)}
    />
  );
}
