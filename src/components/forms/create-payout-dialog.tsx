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
import { PayoutFields } from "@/components/forms/payout-fields";
import { createPayoutAction, type CreatePayoutState } from "@/server/actions/payout.actions";
import { CreatePayoutClientSchema, type CreatePayoutFormValues } from "@/server/validators/payout.schema";

const defaultValues: CreatePayoutFormValues = { name: "", bankName: "", status: "ACTIVE", note: "" };

export function CreatePayoutDialog() {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<CreatePayoutState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreatePayoutFormValues>({ resolver: zodResolver(CreatePayoutClientSchema), defaultValues });

  function onSubmit(values: CreatePayoutFormValues) {
    startTransition(async () => {
      const result = await createPayoutAction(values);
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
            Thêm payout
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm payout</DialogTitle>
          <DialogDescription>Định nghĩa một lần — khi tạo/sửa Page, chỉ cần chọn từ danh sách này.</DialogDescription>
        </DialogHeader>

        <form id="create-payout-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <PayoutFields idPrefix="create-payout" register={register} control={control} errors={errors} />
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="create-payout-form" disabled={isPending}>
            {isPending ? "Đang tạo..." : "Tạo payout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
