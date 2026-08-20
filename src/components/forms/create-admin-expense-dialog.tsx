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
import { createAdminExpenseAction, type CreateAdminExpenseState } from "@/server/actions/admin-expense.actions";
import { CreateAdminExpenseClientSchema, type CreateAdminExpenseFormValues } from "@/server/validators/admin-expense.schema";
import type { AdminOption } from "@/server/services/user-account.service";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type CreateAdminExpenseDialogProps = {
  adminOptions: AdminOption[];
};

export function CreateAdminExpenseDialog({ adminOptions }: CreateAdminExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<CreateAdminExpenseState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const adminLabels: Record<string, string> = {};
  for (const option of adminOptions) adminLabels[option.adminId] = option.name;

  const defaultValues: CreateAdminExpenseFormValues = {
    expenseDate: todayIso(),
    amount: "",
    description: "",
    note: "",
    paidByAdminId: "",
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAdminExpenseFormValues>({ resolver: zodResolver(CreateAdminExpenseClientSchema), defaultValues });

  function onSubmit(values: CreateAdminExpenseFormValues) {
    startTransition(async () => {
      const result = await createAdminExpenseAction(values);
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
            Thêm chi phí
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm tài nguyên</DialogTitle>
          <DialogDescription>
            Chi phí không gắn với Page hoặc nhân viên cụ thể — chỉ cộng vào Tổng chi phí hệ thống, không tính vào chi phí nhân viên.
          </DialogDescription>
        </DialogHeader>

        <form id="create-admin-expense-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <Field label="Ngày" htmlFor="admin-expense-date" error={errors.expenseDate?.message}>
            <Input id="admin-expense-date" type="date" {...register("expenseDate")} className="h-10 rounded-lg" />
          </Field>

          <Field label="Số tiền (VND)" htmlFor="admin-expense-amount" error={errors.amount?.message}>
            <Input
              id="admin-expense-amount"
              inputMode="numeric"
              {...register("amount")}
              placeholder="2000000"
              className="h-10 rounded-lg font-data-tabular text-data-tabular"
            />
          </Field>

          <Field label="Nội dung" htmlFor="admin-expense-description" error={errors.description?.message}>
            <Input
              id="admin-expense-description"
              {...register("description")}
              placeholder="Gia hạn tên miền..."
              className="h-10 rounded-lg"
            />
          </Field>

          <Field label="Người chi" htmlFor="admin-expense-paidByAdminId" error={errors.paidByAdminId?.message}>
            <Controller
              control={control}
              name="paidByAdminId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="admin-expense-paidByAdminId" className="h-10 w-full rounded-lg">
                    <SelectValue>{(value: string) => adminLabels[value] ?? "Chọn người chi..."}</SelectValue>
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

          <Field label="Ghi chú" htmlFor="admin-expense-note" error={errors.note?.message}>
            <textarea
              id="admin-expense-note"
              {...register("note")}
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="create-admin-expense-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Thêm chi phí"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
