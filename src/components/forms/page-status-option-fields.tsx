import type { Control, FieldErrors, FieldValues, Path, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { PAGE_STATUS_COLOR_OPTIONS } from "@/lib/page-status-colors";
import { cn } from "@/lib/utils";
import type { PageStatusColorValue } from "@/server/validators/page-status-option.schema";

type PageStatusOptionFormValues = FieldValues & { label: string; color: PageStatusColorValue };

type PageStatusOptionFieldsProps<T extends PageStatusOptionFormValues> = {
  idPrefix: string;
  register: UseFormRegister<T>;
  control: Control<T>;
  errors: FieldErrors<T>;
};

/** Label + preset color swatch — shared by Create/Edit "Loại trạng thái Page" dialogs (user request 2026-08-18). */
export function PageStatusOptionFields<T extends PageStatusOptionFormValues>({
  idPrefix,
  register,
  control,
  errors,
}: PageStatusOptionFieldsProps<T>) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-stack-md">
      <Field label="Tên loại" htmlFor={`${idPrefix}-label`} error={errors.label?.message as string | undefined}>
        <Input
          id={`${idPrefix}-label`}
          {...register("label" as Path<T>)}
          placeholder="Hoạt động"
          maxLength={30}
          className="h-10 rounded-lg"
        />
      </Field>

      <Field label="Màu" htmlFor={`${idPrefix}-color`} error={errors.color?.message as string | undefined}>
        <Controller
          control={control}
          name={"color" as Path<T>}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id={`${idPrefix}-color`} className="h-10 w-28 rounded-lg">
                <SelectValue>
                  {(value: PageStatusColorValue) => {
                    const option = PAGE_STATUS_COLOR_OPTIONS.find((item) => item.value === value);
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
                {PAGE_STATUS_COLOR_OPTIONS.map((option) => (
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
  );
}
