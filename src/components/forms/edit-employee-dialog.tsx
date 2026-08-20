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
import { updateEmployeeAction, type UpdateEmployeeState } from "@/server/actions/employee.actions";
import { UpdateEmployeeSchema, type UpdateEmployeeFormValues } from "@/server/validators/employee.schema";

const employeeStatusLabels: Record<string, string> = {
  ACTIVE: "Hoạt động",
  INACTIVE: "Ngừng hoạt động",
};

type EditEmployeeDialogProps = {
  employeeId: string;
  defaultValues: UpdateEmployeeFormValues;
};

export function EditEmployeeDialog({ employeeId, defaultValues }: EditEmployeeDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<UpdateEmployeeState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateEmployeeFormValues>({ resolver: zodResolver(UpdateEmployeeSchema), defaultValues });

  function onSubmit(values: UpdateEmployeeFormValues) {
    startTransition(async () => {
      const result = await updateEmployeeAction(employeeId, values);
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
            Chỉnh sửa
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa nhân viên</DialogTitle>
          <DialogDescription>Cập nhật tên, email và trạng thái tài khoản.</DialogDescription>
        </DialogHeader>

        <form id="edit-employee-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <Field label="Họ tên" htmlFor="edit-name" error={errors.name?.message}>
            <Input id="edit-name" {...register("name")} className="h-10 rounded-lg" />
          </Field>

          <Field
            label="Email"
            htmlFor="edit-email"
            error={errors.email?.message ?? (actionState?.status === "error" ? actionState.fieldErrors?.email : undefined)}
          >
            <Input id="edit-email" type="email" {...register("email")} className="h-10 rounded-lg" />
          </Field>

          <Field label="Trạng thái" htmlFor="edit-status" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="edit-status" className="h-10 w-full rounded-lg">
                    <SelectValue>{(value: string) => employeeStatusLabels[value] ?? value}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Hoạt động</SelectItem>
                    <SelectItem value="INACTIVE">Ngừng hoạt động</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="edit-employee-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
