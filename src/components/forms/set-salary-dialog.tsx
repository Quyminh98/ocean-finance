"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Wallet } from "lucide-react";
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
import { setEmployeeSalaryAction, type SetEmployeeSalaryState } from "@/server/actions/employee.actions";
import { SetEmployeeSalaryClientSchema, type SetEmployeeSalaryFormValues } from "@/server/validators/employee.schema";
import type { AdminOption } from "@/server/services/user-account.service";
import { formatVnd } from "@/lib/money";
import { formatDate } from "@/lib/dates";

type SetSalaryDialogProps = {
  employeeId: string;
  currentSalary: bigint;
  currentEffectiveFrom: Date | null;
  adminOptions: AdminOption[];
};

export function SetSalaryDialog({ employeeId, currentSalary, currentEffectiveFrom, adminOptions }: SetSalaryDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<SetEmployeeSalaryState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const adminLabels: Record<string, string> = {};
  for (const option of adminOptions) adminLabels[option.adminId] = option.name;

  const defaultValues: SetEmployeeSalaryFormValues = { monthlySalary: "", paidByAdminId: "" };
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SetEmployeeSalaryFormValues>({ resolver: zodResolver(SetEmployeeSalaryClientSchema), defaultValues });

  function onSubmit(values: SetEmployeeSalaryFormValues) {
    startTransition(async () => {
      const result = await setEmployeeSalaryAction(employeeId, values);
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
            <Wallet className="size-3.5" strokeWidth={2} />
            Đổi lương
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đổi lương</DialogTitle>
          <DialogDescription>
            {currentEffectiveFrom
              ? `Lương hiện tại: ${formatVnd(currentSalary)} — hiệu lực từ ${formatDate(currentEffectiveFrom)}. Mức lương mới có hiệu lực ngay hôm nay.`
              : "Nhân viên chưa có lương — tạo mức lương đầu tiên, có hiệu lực ngay hôm nay."}
          </DialogDescription>
        </DialogHeader>

        <form id="set-salary-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <Field label="Lương mới (VND)" htmlFor="monthlySalary" error={errors.monthlySalary?.message}>
            <Input
              id="monthlySalary"
              inputMode="numeric"
              {...register("monthlySalary")}
              placeholder="12000000"
              className="h-10 rounded-lg font-data-tabular text-data-tabular"
            />
          </Field>

          <Field label="Người chi" htmlFor="salary-paidByAdminId" error={errors.paidByAdminId?.message}>
            <Controller
              control={control}
              name="paidByAdminId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="salary-paidByAdminId" className="h-10 w-full rounded-lg">
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
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="set-salary-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Cập nhật lương"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
