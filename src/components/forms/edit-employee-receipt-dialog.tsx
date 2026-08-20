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
import { updateEmployeeReceiptAction, type UpdateEmployeeReceiptState } from "@/server/actions/employee-receipt.actions";
import { UpdateEmployeeReceiptClientSchema, type UpdateEmployeeReceiptFormValues } from "@/server/validators/employee-receipt.schema";
import type { EmployeeOption } from "@/server/services/employee.service";

type EditEmployeeReceiptDialogProps = {
  employeeReceiptId: string;
  employeeOptions: EmployeeOption[];
  defaultValues: UpdateEmployeeReceiptFormValues;
};

export function EditEmployeeReceiptDialog({ employeeReceiptId, employeeOptions, defaultValues }: EditEmployeeReceiptDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<UpdateEmployeeReceiptState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const employeeLabels: Record<string, string> = {};
  for (const option of employeeOptions) employeeLabels[option.employeeId] = option.name;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateEmployeeReceiptFormValues>({ resolver: zodResolver(UpdateEmployeeReceiptClientSchema), defaultValues });

  function onSubmit(values: UpdateEmployeeReceiptFormValues) {
    startTransition(async () => {
      const result = await updateEmployeeReceiptAction(employeeReceiptId, values);
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
          <DialogTitle>Chỉnh sửa khoản đã nhận</DialogTitle>
          <DialogDescription>Đổi nhân viên hoặc tháng sẽ bị chặn nếu trùng với dòng khác đã có.</DialogDescription>
        </DialogHeader>

        <form id="edit-employee-receipt-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <Field label="Nhân viên" htmlFor="edit-employee-receipt-employeeId" error={errors.employeeId?.message}>
            <Controller
              control={control}
              name="employeeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="edit-employee-receipt-employeeId" className="h-10 w-full rounded-lg">
                    <SelectValue>{(value: string) => employeeLabels[value] ?? value}</SelectValue>
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

          <Field label="Tháng" htmlFor="edit-employee-receipt-month" error={errors.receiptMonth?.message}>
            <Input id="edit-employee-receipt-month" type="month" {...register("receiptMonth")} className="h-10 rounded-lg" />
          </Field>

          <Field label="Số tiền (VND)" htmlFor="edit-employee-receipt-amount" error={errors.amount?.message}>
            <Input
              id="edit-employee-receipt-amount"
              inputMode="numeric"
              {...register("amount")}
              className="h-10 rounded-lg font-data-tabular text-data-tabular"
            />
          </Field>

          <Field label="Ghi chú" htmlFor="edit-employee-receipt-note" error={errors.note?.message}>
            <textarea
              id="edit-employee-receipt-note"
              {...register("note")}
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="edit-employee-receipt-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
