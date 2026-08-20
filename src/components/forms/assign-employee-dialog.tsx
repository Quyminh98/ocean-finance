"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
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
import { assignEmployeeAction, type AssignEmployeeState } from "@/server/actions/page.actions";
import { AssignEmployeeClientSchema, type AssignEmployeeFormValues } from "@/server/validators/page.schema";
import type { EmployeeOption } from "@/server/services/employee.service";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type AssignEmployeeDialogProps = {
  pageId: string;
  candidateEmployees: EmployeeOption[];
};

/** First-time "Gán nhân viên" for a Page that has no one assigned yet — distinct from Transfer, which needs an existing owner to close out. */
export function AssignEmployeeDialog({ pageId, candidateEmployees }: AssignEmployeeDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<AssignEmployeeState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const defaultValues: AssignEmployeeFormValues = { employeeId: "", effectiveDate: todayIso(), note: "" };
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssignEmployeeFormValues>({ resolver: zodResolver(AssignEmployeeClientSchema), defaultValues });

  function onSubmit(values: AssignEmployeeFormValues) {
    startTransition(async () => {
      const result = await assignEmployeeAction(pageId, values);
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
            <UserPlus className="size-3.5" strokeWidth={2} />
            Gán nhân viên
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gán nhân viên phụ trách</DialogTitle>
          <DialogDescription>
            Page này chưa có ai phụ trách. Nếu Page có giá mua &gt; 0, chi phí mua sẽ được ghi nhận cho nhân viên được chọn ở đây (người chi đã chọn sẵn lúc tạo Page).
          </DialogDescription>
        </DialogHeader>

        <form id="assign-employee-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <Field label="Nhân viên phụ trách" htmlFor="employeeId" error={errors.employeeId?.message}>
            <Controller
              control={control}
              name="employeeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="employeeId" className="h-10 w-full rounded-lg">
                    <SelectValue placeholder="Chọn nhân viên..." />
                  </SelectTrigger>
                  <SelectContent>
                    {candidateEmployees.map((employee) => (
                      <SelectItem key={employee.employeeId} value={employee.employeeId}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Ngày hiệu lực" htmlFor="assign-effectiveDate" error={errors.effectiveDate?.message}>
            <Input id="assign-effectiveDate" type="date" {...register("effectiveDate")} className="h-10 rounded-lg" />
          </Field>

          <Field label="Ghi chú" htmlFor="assign-note" error={errors.note?.message}>
            <textarea
              id="assign-note"
              {...register("note")}
              rows={2}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="assign-employee-form" disabled={isPending || candidateEmployees.length === 0}>
            {isPending ? "Đang xử lý..." : "Gán nhân viên"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
