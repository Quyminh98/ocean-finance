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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { createAdminReceiptAction, type CreateAdminReceiptState } from "@/server/actions/admin-receipt.actions";
import { CreateAdminReceiptClientSchema, type CreateAdminReceiptFormValues } from "@/server/validators/admin-receipt.schema";
import type { AdminOption } from "@/server/services/user-account.service";
import { currentMonthKey } from "@/lib/dates";

type CreateAdminReceiptDialogProps = {
  adminOptions: AdminOption[];
};

export function CreateAdminReceiptDialog({ adminOptions }: CreateAdminReceiptDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<CreateAdminReceiptState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const adminLabels: Record<string, string> = {};
  for (const option of adminOptions) adminLabels[option.adminId] = option.name;

  const defaultValues: CreateAdminReceiptFormValues = {
    receiptMonth: currentMonthKey(),
    amount: "",
    source: "",
    note: "",
    receivedByAdminId: "",
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAdminReceiptFormValues>({ resolver: zodResolver(CreateAdminReceiptClientSchema), defaultValues });

  function onSubmit(values: CreateAdminReceiptFormValues) {
    startTransition(async () => {
      const result = await createAdminReceiptAction(values);
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
            Thêm khoản nhận
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm khoản Admin đã nhận</DialogTitle>
          <DialogDescription>
            Tiền Admin thực tế đã nhận — tách biệt hoàn toàn với doanh thu Page, không được đồng nhất trong tính toán.
          </DialogDescription>
        </DialogHeader>

        <form id="create-admin-receipt-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <Field label="Tháng nhận" htmlFor="admin-receipt-month" error={errors.receiptMonth?.message}>
            <Input id="admin-receipt-month" type="month" {...register("receiptMonth")} className="h-10 rounded-lg" />
          </Field>

          <Field label="Số tiền (VND)" htmlFor="admin-receipt-amount" error={errors.amount?.message}>
            <Input
              id="admin-receipt-amount"
              inputMode="numeric"
              {...register("amount")}
              placeholder="250000000"
              className="h-10 rounded-lg font-data-tabular text-data-tabular"
            />
          </Field>

          <Field label="Nguồn / mô tả" htmlFor="admin-receipt-source" error={errors.source?.message}>
            <Input
              id="admin-receipt-source"
              {...register("source")}
              placeholder="Chuyển khoản từ đối tác..."
              className="h-10 rounded-lg"
            />
          </Field>

          <Field
            label="Admin nhận"
            htmlFor="admin-receipt-receivedByAdminId"
            error={errors.receivedByAdminId?.message}
          >
            <Controller
              control={control}
              name="receivedByAdminId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="admin-receipt-receivedByAdminId" className="h-10 w-full rounded-lg">
                    <SelectValue>{(value: string) => adminLabels[value] ?? "Chọn admin nhận..."}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {adminOptions.map((option) => (
                      <SelectItem key={option.adminId} value={option.adminId}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Ghi chú" htmlFor="admin-receipt-note" error={errors.note?.message}>
            <textarea
              id="admin-receipt-note"
              {...register("note")}
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="create-admin-receipt-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Thêm khoản nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
