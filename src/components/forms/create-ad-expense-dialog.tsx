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
import { createAdExpenseAction, type CreateAdExpenseState } from "@/server/actions/ads.actions";
import { CreateAdExpenseClientSchema, type CreateAdExpenseFormValues } from "@/server/validators/ads.schema";
import type { EmployeeOption } from "@/server/services/employee.service";
import type { AdminOption } from "@/server/services/user-account.service";
import { currentMonthKey } from "@/lib/dates";

type CreateAdExpenseDialogProps = {
  employeeOptions: EmployeeOption[];
  adminOptions: AdminOption[];
  /** Preselect + lock the Employee field (used when creating from an Employee Detail tab). */
  fixedEmployeeId?: string;
};

export function CreateAdExpenseDialog({ employeeOptions, adminOptions, fixedEmployeeId }: CreateAdExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<CreateAdExpenseState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const employeeLabels: Record<string, string> = {};
  for (const option of employeeOptions) employeeLabels[option.employeeId] = option.name;

  const adminLabels: Record<string, string> = {};
  for (const option of adminOptions) adminLabels[option.adminId] = option.name;

  const defaultValues: CreateAdExpenseFormValues = {
    employeeId: fixedEmployeeId ?? "",
    expenseMonth: currentMonthKey(),
    amount: "",
    note: "",
    paidByAdminId: "",
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAdExpenseFormValues>({ resolver: zodResolver(CreateAdExpenseClientSchema), defaultValues });

  function onSubmit(values: CreateAdExpenseFormValues) {
    startTransition(async () => {
      const result = await createAdExpenseAction(values);
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
            Thêm chi phí Ads
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm chi phí Ads</DialogTitle>
          <DialogDescription>Chi phí Ads tính theo tháng, nhập trực tiếp cho nhân viên.</DialogDescription>
        </DialogHeader>

        <form id="create-ad-expense-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}
          <p className="font-body-md text-body-md text-on-surface-variant">
            Mỗi nhân viên chỉ có một dòng chi phí Ads cho mỗi tháng — nhập lại cho tháng đã có sẽ cập nhật số tiền của tháng đó.
          </p>

          <Field
            label="Nhân viên"
            htmlFor="ad-expense-employeeId"
            error={errors.employeeId?.message ?? (actionState?.status === "error" ? actionState.fieldErrors?.employeeId : undefined)}
          >
            <Controller
              control={control}
              name="employeeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={Boolean(fixedEmployeeId)}>
                  <SelectTrigger id="ad-expense-employeeId" className="h-10 w-full rounded-lg">
                    <SelectValue>{(value: string) => employeeLabels[value] ?? "Chọn nhân viên..."}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {employeeOptions.map((option) => (
                      <SelectItem key={option.employeeId} value={option.employeeId}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Tháng chi" htmlFor="ad-expense-month" error={errors.expenseMonth?.message}>
            <Input id="ad-expense-month" type="month" {...register("expenseMonth")} className="h-10 rounded-lg" />
          </Field>

          <Field label="Số tiền (VND)" htmlFor="ad-expense-amount" error={errors.amount?.message}>
            <Input
              id="ad-expense-amount"
              inputMode="numeric"
              {...register("amount")}
              placeholder="2000000"
              className="h-10 rounded-lg font-data-tabular text-data-tabular"
            />
          </Field>

          <Field label="Người chi" htmlFor="ad-expense-paidByAdminId" error={errors.paidByAdminId?.message}>
            <Controller
              control={control}
              name="paidByAdminId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="ad-expense-paidByAdminId" className="h-10 w-full rounded-lg">
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

          <Field label="Ghi chú" htmlFor="ad-expense-note" error={errors.note?.message}>
            <textarea
              id="ad-expense-note"
              {...register("note")}
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="create-ad-expense-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Thêm chi phí"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
