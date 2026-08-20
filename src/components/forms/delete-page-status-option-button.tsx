"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deletePageStatusOptionAction } from "@/server/actions/page-status-option.actions";

type DeletePageStatusOptionButtonProps = {
  optionId: string;
  label: string;
  inUseCount: number;
};

export function DeletePageStatusOptionButton({ optionId, label, inUseCount }: DeletePageStatusOptionButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 className="size-3.5" strokeWidth={2} />
          Xoá
        </Button>
      }
      title="Xoá loại trạng thái"
      description={
        inUseCount > 0
          ? `"${label}" đang được ${inUseCount} Page dùng — các Page đó sẽ chuyển về "Chưa đặt" sau khi xoá. Không thể hoàn tác.`
          : `"${label}" sẽ bị xoá hẳn. Không thể hoàn tác.`
      }
      confirmLabel="Xoá"
      onConfirm={() => deletePageStatusOptionAction(optionId)}
    />
  );
}
