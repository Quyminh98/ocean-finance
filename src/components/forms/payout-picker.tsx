import type { Control, FieldErrors, FieldValues, Path } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { cn } from "@/lib/utils";
import type { PayoutStatusValue } from "@/server/validators/payout.schema";

/** `name` ("Tên payout") is the identifying label shown here — `bankName` stays the
 * underlying bank account detail, not surfaced in this picker (user request 2026-08-21). */
export type PayoutPickerOption = { payoutId: string; name: string; status: PayoutStatusValue };

const DOT_CLASS: Record<PayoutStatusValue, string> = { ACTIVE: "bg-success-green", ISSUE: "bg-error-red" };

type PayoutPickerFormValues = FieldValues & { payoutId: string };

type PayoutPickerProps<T extends PayoutPickerFormValues> = {
  idPrefix: string;
  control: Control<T>;
  errors: FieldErrors<T>;
  options: PayoutPickerOption[];
};

/** Single-select from the Admin-managed "Payout" list (Cài đặt) — user request 2026-08-20.
 * Reused on Create/Edit Page (Admin), Create System Page (Employee self-service), and the
 * Employee self-edit dialog — same "unset via empty string" pattern as paidByAdminId/sellerId. */
export function PayoutPicker<T extends PayoutPickerFormValues>({ idPrefix, control, errors, options }: PayoutPickerProps<T>) {
  return (
    <Field label="Payout (tuỳ chọn)" htmlFor={`${idPrefix}-payoutId`} error={errors.payoutId?.message as string | undefined}>
      <Controller
        control={control}
        name={"payoutId" as Path<T>}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id={`${idPrefix}-payoutId`} className="h-10 w-full rounded-lg">
              <SelectValue>
                {(value: string) => {
                  const option = options.find((item) => item.payoutId === value);
                  if (!option) return "Chưa chọn payout";
                  return (
                    <span className="flex items-center gap-stack-sm">
                      <span className={cn("size-2.5 rounded-full", DOT_CLASS[option.status])} />
                      {option.name}
                    </span>
                  );
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.payoutId} value={option.payoutId}>
                  <span className="flex items-center gap-stack-sm">
                    <span className={cn("size-2.5 rounded-full", DOT_CLASS[option.status])} />
                    {option.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  );
}
