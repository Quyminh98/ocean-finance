"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Eye, EyeOff, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { createEmployeeAction, type CreateEmployeeState } from "@/server/actions/employee.actions";
import { CreateEmployeeClientSchema, type CreateEmployeeFormValues } from "@/server/validators/employee.schema";

const employeeStatusLabels: Record<string, string> = {
  ACTIVE: "Hoạt động",
  INACTIVE: "Ngừng hoạt động",
};

export function CreateEmployeeForm() {
  const [state, setState] = useState<CreateEmployeeState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateEmployeeFormValues>({
    resolver: zodResolver(CreateEmployeeClientSchema),
    defaultValues: { name: "", email: "", status: "ACTIVE", password: "", confirmPassword: "" },
  });

  function onSubmit(values: CreateEmployeeFormValues) {
    startTransition(async () => {
      setState(await createEmployeeAction(values));
    });
  }

  if (state?.status === "success") {
    return <CreateEmployeeSuccess employeeId={state.employeeId} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-stack-md">
      {state?.status === "error" && !state.fieldErrors ? (
        <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
          {state.error}
        </div>
      ) : null}

      <Field label="Họ tên" htmlFor="name" error={errors.name?.message}>
        <Input id="name" {...register("name")} placeholder="Nguyễn Văn A" className="h-10 rounded-lg" />
      </Field>

      <Field label="Email" htmlFor="email" error={errors.email?.message ?? (state?.status === "error" ? state.fieldErrors?.email : undefined)}>
        <Input id="email" type="email" {...register("email")} placeholder="nva@financehub.vn" className="h-10 rounded-lg" />
      </Field>

      <Field label="Mật khẩu" htmlFor="password" error={errors.password?.message}>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            {...register("password")}
            placeholder="Tối thiểu 8 ký tự"
            autoComplete="new-password"
            className="h-10 rounded-lg pr-10"
          />
          <button
            type="button"
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-on-surface"
          >
            {showPassword ? <EyeOff className="size-4" strokeWidth={2} /> : <Eye className="size-4" strokeWidth={2} />}
          </button>
        </div>
      </Field>

      <Field label="Xác nhận mật khẩu" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
        <Input
          id="confirmPassword"
          type={showPassword ? "text" : "password"}
          {...register("confirmPassword")}
          placeholder="Nhập lại mật khẩu"
          autoComplete="new-password"
          className="h-10 rounded-lg"
        />
      </Field>

      <Field label="Trạng thái" htmlFor="status" error={errors.status?.message}>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="status" className="h-10 w-full rounded-lg">
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

      <div className="flex items-center gap-stack-sm pt-stack-sm">
        <Button type="submit" disabled={isPending} className="bg-ink text-on-primary hover:bg-ink/90">
          {isPending ? "Đang tạo..." : "Tạo nhân viên"}
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/employees" />}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}

function CreateEmployeeSuccess({ employeeId }: { employeeId: string }) {
  return (
    <div className="max-w-xl rounded-lg border border-border-subtle bg-surface-container-lowest p-card-padding">
      <div className="flex items-center gap-stack-sm">
        <div className="flex size-10 items-center justify-center rounded-full bg-surface-ice text-success-green">
          <UserCheck className="size-5" strokeWidth={2} />
        </div>
        <p className="font-headline-sm text-headline-sm text-on-surface">Đã tạo nhân viên thành công</p>
      </div>

      <p className="mt-stack-md font-body-md text-body-md text-on-surface-variant">
        Nhân viên có thể đăng nhập ngay bằng email và mật khẩu bạn vừa đặt.
      </p>
      <p className="mt-stack-sm font-body-md text-body-md text-on-surface-variant">
        Nhân viên chưa có mức lương nào — vào hồ sơ và bấm “Đổi lương” để thiết lập lần đầu.
      </p>

      <div className="mt-stack-md flex items-center gap-stack-sm">
        <Button nativeButton={false} render={<Link href={`/admin/employees/${employeeId}`} />}>Xem hồ sơ nhân viên</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/employees/new" />}>
          Tạo thêm nhân viên khác
        </Button>
      </div>
    </div>
  );
}
