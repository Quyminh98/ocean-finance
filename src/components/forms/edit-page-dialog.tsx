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
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { PageStatusPicker, type PageStatusPickerOption } from "@/components/forms/page-status-picker";
import { updatePageAction, type UpdatePageState } from "@/server/actions/page.actions";
import { UpdatePageClientSchema, type UpdatePageFormValues } from "@/server/validators/page.schema";

type EditPageDialogProps = {
  pageId: string;
  defaultValues: UpdatePageFormValues;
  statusOptions: PageStatusPickerOption[];
};

export function EditPageDialog({ pageId, defaultValues, statusOptions }: EditPageDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<UpdatePageState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdatePageFormValues>({ resolver: zodResolver(UpdatePageClientSchema), defaultValues });

  function onSubmit(values: UpdatePageFormValues) {
    startTransition(async () => {
      const result = await updatePageAction(pageId, values);
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
          <DialogTitle>Chỉnh sửa Page</DialogTitle>
          <DialogDescription>
            Cập nhật tên, URL, trạng thái và ghi chú. Muốn đổi nhân viên phụ trách, dùng “Chuyển giao”.
          </DialogDescription>
        </DialogHeader>

        <form id="edit-page-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <Field label="Tên Page" htmlFor="edit-page-name" error={errors.name?.message}>
            <Input id="edit-page-name" {...register("name")} className="h-10 rounded-lg" />
          </Field>

          <Field
            label="Facebook URL"
            htmlFor="edit-page-url"
            error={errors.facebookUrl?.message ?? (actionState?.status === "error" ? actionState.fieldErrors?.facebookUrl : undefined)}
          >
            <Input id="edit-page-url" {...register("facebookUrl")} className="h-10 rounded-lg" />
          </Field>

          <PageStatusPicker idPrefix="edit-page" control={control} errors={errors} options={statusOptions} />

          <Field label="Ghi chú" htmlFor="edit-page-notes" error={errors.notes?.message}>
            <textarea
              id="edit-page-notes"
              {...register("notes")}
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="edit-page-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
