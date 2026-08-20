"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Field } from "@/components/forms/field";
import { createRevenueAction, type CreateRevenueState } from "@/server/actions/revenue.actions";
import { CreateRevenueClientSchema, type CreateRevenueFormValues } from "@/server/validators/revenue.schema";
import type { PageOption } from "@/server/services/page.service";
import { currentMonthKey } from "@/lib/dates";

type CreateRevenueDialogProps = {
  pageOptions: PageOption[];
  /** Preselect + lock the Page field (used when creating from a Page Detail tab). */
  fixedPageId?: string;
};

export function CreateRevenueDialog({ pageOptions, fixedPageId }: CreateRevenueDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<CreateRevenueState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const pageComboOptions = pageOptions.map((option) => ({ value: option.pageId, label: option.name }));

  const defaultValues: CreateRevenueFormValues = {
    pageId: fixedPageId ?? "",
    revenueMonth: currentMonthKey(),
    amount: "",
    note: "",
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateRevenueFormValues>({ resolver: zodResolver(CreateRevenueClientSchema), defaultValues });

  function onSubmit(values: CreateRevenueFormValues) {
    startTransition(async () => {
      const result = await createRevenueAction(values);
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
            Thêm doanh thu
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm doanh thu</DialogTitle>
          <DialogDescription>
            Nhân viên phụ trách được hệ thống tự xác định theo Page và tháng ghi nhận — không chọn thủ công. Mỗi Page chỉ có một dòng doanh thu/tháng — nhập lại sẽ ghi đè.
          </DialogDescription>
        </DialogHeader>

        <form id="create-revenue-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <Field
            label="Page"
            htmlFor="revenue-pageId"
            error={errors.pageId?.message ?? (actionState?.status === "error" ? actionState.fieldErrors?.pageId : undefined)}
          >
            <Controller
              control={control}
              name="pageId"
              render={({ field }) => (
                <Combobox
                  id="revenue-pageId"
                  options={pageComboOptions}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={Boolean(fixedPageId)}
                  placeholder="Tìm Page..."
                  emptyText="Không tìm thấy Page."
                />
              )}
            />
          </Field>

          <Field label="Tháng ghi nhận" htmlFor="revenue-month" error={errors.revenueMonth?.message}>
            <Input id="revenue-month" type="month" {...register("revenueMonth")} className="h-10 rounded-lg" />
          </Field>

          <Field label="Số tiền (VND)" htmlFor="revenue-amount" error={errors.amount?.message}>
            <Input
              id="revenue-amount"
              inputMode="numeric"
              {...register("amount")}
              placeholder="45000000"
              className="h-10 rounded-lg font-data-tabular text-data-tabular"
            />
          </Field>

          <Field label="Ghi chú" htmlFor="revenue-note" error={errors.note?.message}>
            <textarea
              id="revenue-note"
              {...register("note")}
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="create-revenue-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Thêm doanh thu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
