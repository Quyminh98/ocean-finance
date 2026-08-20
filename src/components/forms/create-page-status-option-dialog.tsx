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
import { PageStatusOptionFields } from "@/components/forms/page-status-option-fields";
import { createPageStatusOptionAction, type CreatePageStatusOptionState } from "@/server/actions/page-status-option.actions";
import { CreatePageStatusOptionClientSchema, type CreatePageStatusOptionFormValues } from "@/server/validators/page-status-option.schema";

const defaultValues: CreatePageStatusOptionFormValues = { label: "", color: "GREEN" };

export function CreatePageStatusOptionDialog() {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<CreatePageStatusOptionState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreatePageStatusOptionFormValues>({ resolver: zodResolver(CreatePageStatusOptionClientSchema), defaultValues });

  function onSubmit(values: CreatePageStatusOptionFormValues) {
    startTransition(async () => {
      const result = await createPageStatusOptionAction(values);
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
            Thêm loại
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm loại trạng thái Page</DialogTitle>
          <DialogDescription>Định nghĩa một lần — mọi Page sau đó chỉ cần chọn từ danh sách này.</DialogDescription>
        </DialogHeader>

        <form id="create-page-status-option-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <PageStatusOptionFields idPrefix="create-page-status-option" register={register} control={control} errors={errors} />
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="create-page-status-option-form" disabled={isPending}>
            {isPending ? "Đang tạo..." : "Tạo loại"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
