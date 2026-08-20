"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightLeft } from "lucide-react";
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
import { transferPageAction, type TransferPageState } from "@/server/actions/page.actions";
import { TransferPageClientSchema, type TransferPageFormValues } from "@/server/validators/page.schema";
import type { EmployeeOption } from "@/server/services/employee.service";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type TransferPageDialogProps = {
  pageId: string;
  currentEmployeeName: string;
  candidateEmployees: EmployeeOption[];
};

/** Transfer Page action modal (spec §15.4) — generated fresh from `.stitch/DESIGN.md` (no matching Stitch screen). */
export function TransferPageDialog({ pageId, currentEmployeeName, candidateEmployees }: TransferPageDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<TransferPageState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const defaultValues: TransferPageFormValues = { newEmployeeId: "", effectiveDate: todayIso(), note: "" };
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TransferPageFormValues>({ resolver: zodResolver(TransferPageClientSchema), defaultValues });

  function onSubmit(values: TransferPageFormValues) {
    startTransition(async () => {
      const result = await transferPageAction(pageId, values);
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
            <ArrowRightLeft className="size-3.5" strokeWidth={2} />
            Chuyển giao
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chuyển giao Page</DialogTitle>
          <DialogDescription>
            Đang thuộc {currentEmployeeName}. Doanh thu/Ads đã ghi nhận trước ngày hiệu lực sẽ giữ nguyên chủ sở hữu cũ.
          </DialogDescription>
        </DialogHeader>

        <form id="transfer-page-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <Field label="Nhân viên mới" htmlFor="newEmployeeId" error={errors.newEmployeeId?.message}>
            <Controller
              control={control}
              name="newEmployeeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="newEmployeeId" className="h-10 w-full rounded-lg">
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

          <Field label="Ngày hiệu lực" htmlFor="effectiveDate" error={errors.effectiveDate?.message}>
            <Input id="effectiveDate" type="date" {...register("effectiveDate")} className="h-10 rounded-lg" />
          </Field>

          <Field label="Ghi chú" htmlFor="transfer-note" error={errors.note?.message}>
            <textarea
              id="transfer-note"
              {...register("note")}
              rows={2}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="transfer-page-form" disabled={isPending || candidateEmployees.length === 0}>
            {isPending ? "Đang xử lý..." : "Chuyển giao"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
