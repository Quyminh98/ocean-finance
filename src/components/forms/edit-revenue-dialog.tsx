"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Combobox } from "@/components/ui/combobox";
import { Field } from "@/components/forms/field";
import { updateRevenueAction, type UpdateRevenueState } from "@/server/actions/revenue.actions";
import { UpdateRevenueClientSchema, type UpdateRevenueFormValues } from "@/server/validators/revenue.schema";
import type { PageOption } from "@/server/services/page.service";

type EditRevenueDialogProps = {
  revenueId: string;
  pageOptions: PageOption[];
  defaultValues: UpdateRevenueFormValues;
};

export function EditRevenueDialog({ revenueId, pageOptions, defaultValues }: EditRevenueDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<UpdateRevenueState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const pageComboOptions = pageOptions.map((option) => ({ value: option.pageId, label: option.name }));

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateRevenueFormValues>({ resolver: zodResolver(UpdateRevenueClientSchema), defaultValues });

  function onSubmit(values: UpdateRevenueFormValues) {
    startTransition(async () => {
      const result = await updateRevenueAction(revenueId, values);
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
            Sửa
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa doanh thu</DialogTitle>
          <DialogDescription>
            Đổi Page hoặc tháng ghi nhận sẽ xác định lại nhân viên phụ trách tương ứng.
          </DialogDescription>
        </DialogHeader>

        <form id="edit-revenue-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <Field
            label="Page"
            htmlFor="edit-revenue-pageId"
            error={errors.pageId?.message ?? (actionState?.status === "error" ? actionState.fieldErrors?.pageId : undefined)}
          >
            <Controller
              control={control}
              name="pageId"
              render={({ field }) => (
                <Combobox
                  id="edit-revenue-pageId"
                  options={pageComboOptions}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Tìm Page..."
                  emptyText="Không tìm thấy Page."
                />
              )}
            />
          </Field>

          <Field label="Tháng ghi nhận" htmlFor="edit-revenue-month" error={errors.revenueMonth?.message}>
            <Input id="edit-revenue-month" type="month" {...register("revenueMonth")} className="h-10 rounded-lg" />
          </Field>

          <Field label="Số tiền (VND)" htmlFor="edit-revenue-amount" error={errors.amount?.message}>
            <Input
              id="edit-revenue-amount"
              inputMode="numeric"
              {...register("amount")}
              className="h-10 rounded-lg font-data-tabular text-data-tabular"
            />
          </Field>

          <Field label="Ghi chú" htmlFor="edit-revenue-note" error={errors.note?.message}>
            <textarea
              id="edit-revenue-note"
              {...register("note")}
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="edit-revenue-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
