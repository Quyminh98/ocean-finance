"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { PageStatusPicker, type PageStatusPickerOption } from "@/components/forms/page-status-picker";
import { PayoutPicker, type PayoutPickerOption } from "@/components/forms/payout-picker";
import { createPageAction, type CreatePageState } from "@/server/actions/page.actions";
import { CreatePageClientSchema, NO_EMPLOYEE_SENTINEL, PAGE_TYPES, type CreatePageFormValues } from "@/server/validators/page.schema";
import type { EmployeeOption } from "@/server/services/employee.service";
import type { AdminOption } from "@/server/services/user-account.service";
import type { SellerListItem } from "@/server/services/seller.service";
import { currentMonthKey } from "@/lib/dates";

type CreatePageFormProps = {
  employees: EmployeeOption[];
  adminOptions: AdminOption[];
  statusOptions: PageStatusPickerOption[];
  sellers: SellerListItem[];
  payouts: PayoutPickerOption[];
};

export function CreatePageForm({ employees, adminOptions, statusOptions, sellers, payouts }: CreatePageFormProps) {
  const router = useRouter();
  const [state, setState] = useState<CreatePageState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const employeeLabels: Record<string, string> = { [NO_EMPLOYEE_SENTINEL]: "Chưa gán — gán sau" };
  for (const employee of employees) employeeLabels[employee.employeeId] = employee.name;

  const adminLabels: Record<string, string> = {};
  for (const option of adminOptions) adminLabels[option.adminId] = option.name;

  const sellerLabels: Record<string, string> = {};
  for (const seller of sellers) sellerLabels[seller.sellerId] = seller.name;

  const pageTypeLabels: Record<(typeof PAGE_TYPES)[number], string> = { SYSTEM: "Page hệ thống", BKT: "Page BKT" };

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreatePageFormValues>({
    resolver: zodResolver(CreatePageClientSchema),
    defaultValues: {
      name: "",
      facebookUrl: "",
      pageType: "BKT",
      purchasePrice: "0",
      purchaseMonth: currentMonthKey(),
      assignEmployeeId: NO_EMPLOYEE_SENTINEL,
      paidByAdminId: "",
      sellerId: "",
      payoutId: "",
      statusIds: [],
      notes: "",
    },
  });

  const pageType = useWatch({ control, name: "pageType" });
  const isSystemPage = pageType === "SYSTEM";
  const purchasePrice = useWatch({ control, name: "purchasePrice" });
  const needsPayer = !isSystemPage && Boolean(purchasePrice) && purchasePrice !== "0";

  // Page hệ thống không có giá mua — ép về 0/bỏ người chi ngay khi đổi loại,
  // tránh gửi lên server một giá trị ẩn không khớp (service reject nếu lệch).
  useEffect(() => {
    if (isSystemPage) {
      setValue("purchasePrice", "0");
      setValue("paidByAdminId", "");
      setValue("sellerId", "");
    }
  }, [isSystemPage, setValue]);

  function onSubmit(values: CreatePageFormValues) {
    startTransition(async () => {
      const result = await createPageAction(values);
      if (result.status === "error") {
        setState(result);
        return;
      }
      router.push(`/admin/pages/${result.pageId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-stack-md">
      {state?.status === "error" && !state.fieldErrors ? (
        <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
          {state.error}
        </div>
      ) : null}

      <Field label="Tên Page" htmlFor="name" error={errors.name?.message}>
        <Input id="name" {...register("name")} placeholder="VN_Global_Ecom_01" className="h-10 rounded-lg" />
      </Field>

      <Field
        label="Facebook URL"
        htmlFor="facebookUrl"
        error={errors.facebookUrl?.message ?? (state?.status === "error" ? state.fieldErrors?.facebookUrl : undefined)}
      >
        <Input
          id="facebookUrl"
          {...register("facebookUrl")}
          placeholder="https://facebook.com/vnglobalecom01"
          className="h-10 rounded-lg"
        />
      </Field>

      <Field label="Loại Page" htmlFor="pageType" error={errors.pageType?.message}>
        <Controller
          control={control}
          name="pageType"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="pageType" className="h-10 w-full rounded-lg">
                <SelectValue>{(value: string) => pageTypeLabels[value as (typeof PAGE_TYPES)[number]] ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAGE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {pageTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <div className={isSystemPage ? "grid grid-cols-1 gap-stack-md" : "grid grid-cols-2 gap-stack-md"}>
        {isSystemPage ? null : (
          <Field label="Giá mua (VND)" htmlFor="purchasePrice" error={errors.purchasePrice?.message}>
            <Input
              id="purchasePrice"
              inputMode="numeric"
              {...register("purchasePrice")}
              placeholder="5000000"
              className="h-10 rounded-lg font-data-tabular text-data-tabular"
            />
          </Field>
        )}

        <Field label="Tháng mua" htmlFor="purchaseMonth" error={errors.purchaseMonth?.message}>
          <Input id="purchaseMonth" type="month" {...register("purchaseMonth")} className="h-10 rounded-lg" />
        </Field>
      </div>

      <Field label="Gán nhân viên phụ trách (tuỳ chọn)" htmlFor="assignEmployeeId" error={errors.assignEmployeeId?.message}>
        <Controller
          control={control}
          name="assignEmployeeId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="assignEmployeeId" className="h-10 w-full rounded-lg">
                <SelectValue>{(value: string) => employeeLabels[value] ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_EMPLOYEE_SENTINEL}>Chưa gán — gán sau</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.employeeId} value={employee.employeeId}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      {needsPayer ? (
        <Field label="Người chi (mua Page)" htmlFor="paidByAdminId" error={errors.paidByAdminId?.message}>
          <Controller
            control={control}
            name="paidByAdminId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="paidByAdminId" className="h-10 w-full rounded-lg">
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
      ) : null}

      {isSystemPage ? null : (
        <Field label="Người bán (tuỳ chọn)" htmlFor="sellerId" error={errors.sellerId?.message}>
          <Controller
            control={control}
            name="sellerId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="sellerId" className="h-10 w-full rounded-lg">
                  <SelectValue>{(value: string) => sellerLabels[value] ?? "Chưa chọn người bán"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.sellerId} value={seller.sellerId}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      )}

      <PayoutPicker idPrefix="create-page" control={control} errors={errors} options={payouts} />

      <PageStatusPicker idPrefix="create-page" control={control} errors={errors} options={statusOptions} />

      <Field label="Ghi chú" htmlFor="notes" error={errors.notes?.message}>
        <textarea
          id="notes"
          {...register("notes")}
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </Field>

      <div className="flex items-center gap-stack-sm pt-stack-sm">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Đang tạo..." : "Tạo Page"}
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/pages" />}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}
