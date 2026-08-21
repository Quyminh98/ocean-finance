"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
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
import { createSellerAction, type CreateSellerState } from "@/server/actions/seller.actions";
import { CreateSellerClientSchema, type CreateSellerFormValues } from "@/server/validators/seller.schema";

const defaultValues: CreateSellerFormValues = { name: "" };

export function CreateSellerDialog() {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<CreateSellerState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateSellerFormValues>({ resolver: zodResolver(CreateSellerClientSchema), defaultValues });

  function onSubmit(values: CreateSellerFormValues) {
    startTransition(async () => {
      const result = await createSellerAction(values);
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
          <Button>
            <Plus className="size-4" strokeWidth={2} />
            Thêm người bán
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm người bán</DialogTitle>
          <DialogDescription>Định nghĩa một lần — khi tạo Page BKT, chỉ cần chọn từ danh sách này.</DialogDescription>
        </DialogHeader>

        <form id="create-seller-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <SellerFields idPrefix="create-seller" register={register} errors={errors} />
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="create-seller-form" disabled={isPending}>
            {isPending ? "Đang tạo..." : "Tạo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
