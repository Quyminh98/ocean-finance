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
import { PageStatusPicker, type PageStatusPickerOption } from "@/components/forms/page-status-picker";
import { updatePageStatusAction, type UpdatePageStatusState } from "@/server/actions/page.actions";
import { UpdatePageStatusClientSchema, type UpdatePageStatusFormValues } from "@/server/validators/page.schema";

type EditPageStatusDialogProps = {
  pageId: string;
  defaultValues: UpdatePageStatusFormValues;
  statusOptions: PageStatusPickerOption[];
};

/** User-role counterpart of `EditPageDialog` — only the "Trạng thái" field is editable (spec §12, user request 2026-08-18 "chỉ có thể edit được trạng thái thôi"). */
export function EditPageStatusDialog({ pageId, defaultValues, statusOptions }: EditPageStatusDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<UpdatePageStatusState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdatePageStatusFormValues>({ resolver: zodResolver(UpdatePageStatusClientSchema), defaultValues });

  function onSubmit(values: UpdatePageStatusFormValues) {
    startTransition(async () => {
      const result = await updatePageStatusAction(pageId, values);
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
            Sửa trạng thái
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa trạng thái Page</DialogTitle>
          <DialogDescription>Bạn chỉ có thể cập nhật trạng thái của Page mình đang phụ trách.</DialogDescription>
        </DialogHeader>

        <form id="edit-page-status-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <PageStatusPicker idPrefix="user-edit-page" control={control} errors={errors} options={statusOptions} />
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="edit-page-status-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
