"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteSellerAction } from "@/server/actions/seller.actions";

type DeleteSellerButtonProps = {
  sellerId: string;
  name: string;
  inUseCount: number;
};

export function DeleteSellerButton({ sellerId, name, inUseCount }: DeleteSellerButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 className="size-3.5" strokeWidth={2} />
          Xoá
        </Button>
      }
      title="Xoá người bán"
      description={
        inUseCount > 0
          ? `"${name}" đang được ${inUseCount} Page dùng — các Page đó sẽ mất người bán sau khi xoá. Không thể hoàn tác.`
          : `"${name}" sẽ bị xoá hẳn. Không thể hoàn tác.`
      }
      confirmLabel="Xoá"
      onConfirm={() => deleteSellerAction(sellerId)}
    />
  );
}
