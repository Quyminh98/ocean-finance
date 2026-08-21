"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteViaAction } from "@/server/actions/via.actions";

type DeleteViaButtonProps = {
  viaId: string;
  name: string;
};

export function DeleteViaButton({ viaId, name }: DeleteViaButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 className="size-3.5" strokeWidth={2} />
          Xoá
        </Button>
      }
      title="Xoá via"
      description={`"${name}" sẽ bị xoá hẳn. Không thể hoàn tác.`}
      confirmLabel="Xoá"
      onConfirm={() => deleteViaAction(viaId)}
    />
  );
}
