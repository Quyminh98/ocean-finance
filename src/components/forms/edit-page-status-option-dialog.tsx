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
import { PageStatusOptionFields } from "@/components/forms/page-status-option-fields";
import { updatePageStatusOptionAction, type UpdatePageStatusOptionState } from "@/server/actions/page-status-option.actions";
import { UpdatePageStatusOptionClientSchema, type UpdatePageStatusOptionFormValues } from "@/server/validators/page-status-option.schema";

type EditPageStatusOptionDialogProps = {
  optionId: string;
  defaultValues: UpdatePageStatusOptionFormValues;
};

export function EditPageStatusOptionDialog({ optionId, defaultValues }: EditPageStatusOptionDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<UpdatePageStatusOptionState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdatePageStatusOptionFormValues>({ resolver: zodResolver(UpdatePageStatusOptionClientSchema), defaultValues });

  function onSubmit(values: UpdatePageStatusOptionFormValues) {
    startTransition(async () => {
      const result = await updatePageStatusOptionAction(optionId, values);
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
          <DialogTitle>Chỉnh sửa loại trạng thái</DialogTitle>
          <DialogDescription>Đổi tên/màu áp dụng ngay cho mọi Page đang dùng loại này.</DialogDescription>
        </DialogHeader>

        <form id="edit-page-status-option-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <PageStatusOptionFields idPrefix="edit-page-status-option" register={register} control={control} errors={errors} />
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="edit-page-status-option-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
