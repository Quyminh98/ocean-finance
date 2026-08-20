import type { Control, FieldErrors, FieldValues, Path } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { PAGE_STATUS_COLOR_OPTIONS } from "@/lib/page-status-colors";
import { cn } from "@/lib/utils";
import type { PageStatusColorValue } from "@/server/validators/page-status-option.schema";

export type PageStatusPickerOption = { optionId: string; label: string; color: PageStatusColorValue };

type PageStatusPickerFormValues = FieldValues & { statusIds: string[] };

type PageStatusPickerProps<T extends PageStatusPickerFormValues> = {
  idPrefix: string;
  control: Control<T>;
  errors: FieldErrors<T>;
  options: PageStatusPickerOption[];
};

/** Multi-select from the Admin-managed "Loại trạng thái Page" list (Cài đặt) — user request 2026-08-18: "có thể chọn nhiều trạng thái được". Uses Base UI Select's native `multiple` mode. */
export function PageStatusPicker<T extends PageStatusPickerFormValues>({ idPrefix, control, errors, options }: PageStatusPickerProps<T>) {
  const dotClassFor = (color: PageStatusColorValue) => PAGE_STATUS_COLOR_OPTIONS.find((item) => item.value === color)?.dotClass;

  return (
    <Field label="Trạng thái" htmlFor={`${idPrefix}-status`} error={errors.statusIds?.message as string | undefined}>
      <Controller
        control={control}
        name={"statusIds" as Path<T>}
        render={({ field }) => (
          <Select multiple value={field.value ?? []} onValueChange={field.onChange}>
            <SelectTrigger id={`${idPrefix}-status`} className="h-10 w-full rounded-lg">
              <SelectValue>
                {(value: string[]) => {
                  if (!value || value.length === 0) return "Chọn trạng thái...";
                  const selected = value
                    .map((id) => options.find((item) => item.optionId === id))
                    .filter((item): item is PageStatusPickerOption => Boolean(item));
                  return (
                    <span className="flex flex-wrap items-center gap-stack-sm">
                      {selected.map((option) => (
                        <span key={option.optionId} className="flex items-center gap-1">
                          <span className={cn("size-2.5 rounded-full", dotClassFor(option.color))} />
                          {option.label}
                        </span>
                      ))}
                    </span>
                  );
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.optionId} value={option.optionId}>
                  <span className="flex items-center gap-stack-sm">
                    <span className={cn("size-2.5 rounded-full", dotClassFor(option.color))} />
                    {option.label}
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
