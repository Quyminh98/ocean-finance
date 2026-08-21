"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deletePayoutAction } from "@/server/actions/payout.actions";

type DeletePayoutButtonProps = {
  payoutId: string;
  name: string;
  inUseCount: number;
};

export function DeletePayoutButton({ payoutId, name, inUseCount }: DeletePayoutButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 className="size-3.5" strokeWidth={2} />
          Xoá
        </Button>
      }
      title="Xoá payout"
      description={
        inUseCount > 0
          ? `"${name}" đang được ${inUseCount} Page dùng — các Page đó sẽ mất payout sau khi xoá. Không thể hoàn tác.`
          : `"${name}" sẽ bị xoá hẳn. Không thể hoàn tác.`
      }
      confirmLabel="Xoá"
      onConfirm={() => deletePayoutAction(payoutId)}
    />
  );
}
