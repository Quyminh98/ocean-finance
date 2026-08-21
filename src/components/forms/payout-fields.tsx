import type { Control, FieldErrors, FieldValues, Path, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { cn } from "@/lib/utils";
import type { PayoutStatusValue } from "@/server/validators/payout.schema";

const PAYOUT_STATUS_OPTIONS: { value: PayoutStatusValue; label: string; dotClass: string }[] = [
  { value: "ACTIVE", label: "Đang hoạt động", dotClass: "bg-success-green" },
  { value: "ISSUE", label: "Có vấn đề", dotClass: "bg-error-red" },
];

type PayoutFormValues = FieldValues & { name: string; bankName: string; status: PayoutStatusValue; note?: string };

type PayoutFieldsProps<T extends PayoutFormValues> = {
  idPrefix: string;
  register: UseFormRegister<T>;
  control: Control<T>;
  errors: FieldErrors<T>;
};

/** Tên payout + tên bank + trạng thái (2 giá trị cố định) + ghi chú — shared by Create/Edit "Payout" dialogs. */
export function PayoutFields<T extends PayoutFormValues>({ idPrefix, register, control, errors }: PayoutFieldsProps<T>) {
  return (
    <div className="space-y-stack-md">
      <Field label="Tên payout" htmlFor={`${idPrefix}-name`} error={errors.name?.message as string | undefined}>
        <Input id={`${idPrefix}-name`} {...register("name" as Path<T>)} placeholder="Payout chính" maxLength={100} className="h-10 rounded-lg" />
      </Field>

      <div className="grid grid-cols-[1fr_auto] gap-stack-md">
        <Field label="Tên bank" htmlFor={`${idPrefix}-bankName`} error={errors.bankName?.message as string | undefined}>
          <Input id={`${idPrefix}-bankName`} {...register("bankName" as Path<T>)} placeholder="Vietcombank - 0123456789" maxLength={100} className="h-10 rounded-lg" />
        </Field>

        <Field label="Trạng thái" htmlFor={`${idPrefix}-status`} error={errors.status?.message as string | undefined}>
          <Controller
            control={control}
            name={"status" as Path<T>}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={`${idPrefix}-status`} className="h-10 w-44 rounded-lg">
                  <SelectValue>
                    {(value: PayoutStatusValue) => {
                      const option = PAYOUT_STATUS_OPTIONS.find((item) => item.value === value);
                      return (
                        <span className="flex items-center gap-stack-sm">
                          <span className={cn("size-2.5 rounded-full", option?.dotClass)} />
                          {option?.label ?? value}
                        </span>
                      );
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYOUT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-stack-sm">
                        <span className={cn("size-2.5 rounded-full", option.dotClass)} />
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>

      <Field label="Ghi chú" htmlFor={`${idPrefix}-note`} error={errors.note?.message as string | undefined}>
        <textarea
          id={`${idPrefix}-note`}
          {...register("note" as Path<T>)}
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </Field>
    </div>
  );
}
