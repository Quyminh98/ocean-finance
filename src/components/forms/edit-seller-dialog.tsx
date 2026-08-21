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
import { SellerFields } from "@/components/forms/seller-fields";
import { updateSellerAction, type UpdateSellerState } from "@/server/actions/seller.actions";
import { UpdateSellerClientSchema, type UpdateSellerFormValues } from "@/server/validators/seller.schema";

type EditSellerDialogProps = {
  sellerId: string;
  defaultValues: UpdateSellerFormValues;
};

export function EditSellerDialog({ sellerId, defaultValues }: EditSellerDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<UpdateSellerState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateSellerFormValues>({ resolver: zodResolver(UpdateSellerClientSchema), defaultValues });

  function onSubmit(values: UpdateSellerFormValues) {
    startTransition(async () => {
      const result = await updateSellerAction(sellerId, values);
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
          <DialogTitle>Chỉnh sửa người bán</DialogTitle>
          <DialogDescription>Đổi tên áp dụng ngay cho mọi Page đang gắn người bán này.</DialogDescription>
        </DialogHeader>

        <form id="edit-seller-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <SellerFields idPrefix="edit-seller" register={register} errors={errors} />
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="edit-seller-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
