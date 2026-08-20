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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { updateAdminExpenseAction, type UpdateAdminExpenseState } from "@/server/actions/admin-expense.actions";
import { UpdateAdminExpenseClientSchema, type UpdateAdminExpenseFormValues } from "@/server/validators/admin-expense.schema";
import type { AdminOption } from "@/server/services/user-account.service";

type EditAdminExpenseDialogProps = {
  adminExpenseId: string;
  adminOptions: AdminOption[];
  defaultValues: UpdateAdminExpenseFormValues;
};

export function EditAdminExpenseDialog({ adminExpenseId, adminOptions, defaultValues }: EditAdminExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<UpdateAdminExpenseState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const adminLabels: Record<string, string> = {};
  for (const option of adminOptions) adminLabels[option.adminId] = option.name;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateAdminExpenseFormValues>({ resolver: zodResolver(UpdateAdminExpenseClientSchema), defaultValues });

  function onSubmit(values: UpdateAdminExpenseFormValues) {
    startTransition(async () => {
      const result = await updateAdminExpenseAction(adminExpenseId, values);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa chi phí</DialogTitle>
          <DialogDescription>Cập nhật thông tin tài nguyên.</DialogDescription>
        </DialogHeader>

        <form id="edit-admin-expense-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <Field label="Ngày" htmlFor="edit-admin-expense-date" error={errors.expenseDate?.message}>
            <Input id="edit-admin-expense-date" type="date" {...register("expenseDate")} className="h-10 rounded-lg" />
          </Field>

          <Field label="Số tiền (VND)" htmlFor="edit-admin-expense-amount" error={errors.amount?.message}>
            <Input
              id="edit-admin-expense-amount"
              inputMode="numeric"
              {...register("amount")}
              className="h-10 rounded-lg font-data-tabular text-data-tabular"
            />
          </Field>

          <Field label="Nội dung" htmlFor="edit-admin-expense-description" error={errors.description?.message}>
            <Input id="edit-admin-expense-description" {...register("description")} className="h-10 rounded-lg" />
          </Field>

          <Field label="Người chi" htmlFor="edit-admin-expense-paidByAdminId" error={errors.paidByAdminId?.message}>
            <Controller
              control={control}
              name="paidByAdminId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="edit-admin-expense-paidByAdminId" className="h-10 w-full rounded-lg">
                    <SelectValue>{(value: string) => adminLabels[value] ?? value}</SelectValue>
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

          <Field label="Ghi chú" htmlFor="edit-admin-expense-note" error={errors.note?.message}>
            <textarea
              id="edit-admin-expense-note"
              {...register("note")}
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="edit-admin-expense-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
