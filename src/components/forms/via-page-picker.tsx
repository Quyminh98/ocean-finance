import type { Control, FieldErrors, FieldValues, Path } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import type { PageOption } from "@/server/services/page.service";

type ViaPagePickerFormValues = FieldValues & { pageIds: string[] };

type ViaPagePickerProps<T extends ViaPagePickerFormValues> = {
  idPrefix: string;
  control: Control<T>;
  errors: FieldErrors<T>;
  options: PageOption[];
};

/** Multi-select of every Page in the system (user request 2026-08-20 — "1 page ở nhiều via
 * được không, tôi muốn thế") — not restricted to Pages the Via's holder manages. Same Base UI
 * Select `multiple` mode as PageStatusPicker. */
export function ViaPagePicker<T extends ViaPagePickerFormValues>({ idPrefix, control, errors, options }: ViaPagePickerProps<T>) {
  return (
    <Field label="Gắn với Page (tuỳ chọn)" htmlFor={`${idPrefix}-pageIds`} error={errors.pageIds?.message as string | undefined}>
      <Controller
        control={control}
        name={"pageIds" as Path<T>}
        render={({ field }) => (
          <Select multiple value={field.value ?? []} onValueChange={field.onChange}>
            <SelectTrigger id={`${idPrefix}-pageIds`} className="h-10 w-full rounded-lg">
              <SelectValue>
                {(value: string[]) => {
                  if (!value || value.length === 0) return "Chưa gắn Page nào";
                  const selected = value
                    .map((id) => options.find((item) => item.pageId === id))
                    .filter((item): item is PageOption => Boolean(item));
                  return selected.map((option) => option.name).join(", ");
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.pageId} value={option.pageId}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  );
}
