"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PayoutFields } from "@/components/forms/payout-fields";
import { updatePayoutAction, type UpdatePayoutState } from "@/server/actions/payout.actions";
import { UpdatePayoutClientSchema, type UpdatePayoutFormValues } from "@/server/validators/payout.schema";

type EditPayoutDialogProps = {
  payoutId: string;
  defaultValues: UpdatePayoutFormValues;
};

export function EditPayoutDialog({ payoutId, defaultValues }: EditPayoutDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<UpdatePayoutState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdatePayoutFormValues>({ resolver: zodResolver(UpdatePayoutClientSchema), defaultValues });

  function onSubmit(values: UpdatePayoutFormValues) {
    startTransition(async () => {
      const result = await updatePayoutAction(payoutId, values);
      if (result.status === "error") {
        setActionState(result);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset(defaultValues);
          setActionState(undefined);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="size-3.5" strokeWidth={2} />
            Chỉnh sửa
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa payout</DialogTitle>
          <DialogDescription>Đổi tên bank/trạng thái áp dụng ngay cho mọi Page đang dùng payout này.</DialogDescription>
        </DialogHeader>

        <form id="edit-payout-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <PayoutFields idPrefix="edit-payout" register={register} control={control} errors={errors} />
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="edit-payout-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
