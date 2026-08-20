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
import { createEmployeeReceiptAction, type CreateEmployeeReceiptState } from "@/server/actions/employee-receipt.actions";
import { CreateEmployeeReceiptClientSchema, type CreateEmployeeReceiptFormValues } from "@/server/validators/employee-receipt.schema";
import type { EmployeeOption } from "@/server/services/employee.service";
import { currentMonthKey } from "@/lib/dates";

type CreateEmployeeReceiptDialogProps = {
  employeeOptions: EmployeeOption[];
};

export function CreateEmployeeReceiptDialog({ employeeOptions }: CreateEmployeeReceiptDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<CreateEmployeeReceiptState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const employeeLabels: Record<string, string> = {};
  for (const option of employeeOptions) employeeLabels[option.employeeId] = option.name;

  const defaultValues: CreateEmployeeReceiptFormValues = {
    employeeId: "",
    receiptMonth: currentMonthKey(),
    amount: "",
    note: "",
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateEmployeeReceiptFormValues>({ resolver: zodResolver(CreateEmployeeReceiptClientSchema), defaultValues });

  function onSubmit(values: CreateEmployeeReceiptFormValues) {
    startTransition(async () => {
      const result = await createEmployeeReceiptAction(values);
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
            Thêm khoản đã nhận
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm tiền nhân viên đã nhận</DialogTitle>
          <DialogDescription>
            Ghi nhận để xem — không cộng vào Doanh thu/Chi phí của nhân viên. Mỗi nhân viên chỉ có một dòng/tháng — nhập lại sẽ ghi đè.
          </DialogDescription>
        </DialogHeader>

        <form id="create-employee-receipt-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <Field label="Nhân viên" htmlFor="employee-receipt-employeeId" error={errors.employeeId?.message}>
            <Controller
              control={control}
              name="employeeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="employee-receipt-employeeId" className="h-10 w-full rounded-lg">
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

          <Field label="Tháng" htmlFor="employee-receipt-month" error={errors.receiptMonth?.message}>
            <Input id="employee-receipt-month" type="month" {...register("receiptMonth")} className="h-10 rounded-lg" />
          </Field>

          <Field label="Số tiền (VND)" htmlFor="employee-receipt-amount" error={errors.amount?.message}>
            <Input
              id="employee-receipt-amount"
              inputMode="numeric"
              {...register("amount")}
              placeholder="5000000"
              className="h-10 rounded-lg font-data-tabular text-data-tabular"
            />
          </Field>

          <Field label="Ghi chú" htmlFor="employee-receipt-note" error={errors.note?.message}>
            <textarea
              id="employee-receipt-note"
              {...register("note")}
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="create-employee-receipt-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Thêm khoản đã nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
