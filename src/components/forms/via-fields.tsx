import type { FieldErrors, FieldValues, Path, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";

type ViaFormValues = FieldValues & { name: string; facebookUrl: string };

type ViaFieldsProps<T extends ViaFormValues> = {
  idPrefix: string;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
};

/** Tên via + Facebook URL — shared by the self-service "Thêm via" dialog (both roles). */
export function ViaFields<T extends ViaFormValues>({ idPrefix, register, errors }: ViaFieldsProps<T>) {
  return (
    <>
      <Field label="Tên via" htmlFor={`${idPrefix}-name`} error={errors.name?.message as string | undefined}>
        <Input id={`${idPrefix}-name`} {...register("name" as Path<T>)} placeholder="Via 01" maxLength={100} className="h-10 rounded-lg" />
      </Field>

      <Field label="Link Facebook" htmlFor={`${idPrefix}-facebookUrl`} error={errors.facebookUrl?.message as string | undefined}>
        <Input
          id={`${idPrefix}-facebookUrl`}
          {...register("facebookUrl" as Path<T>)}
          placeholder="https://facebook.com/profile.php?id=..."
          className="h-10 rounded-lg"
        />
      </Field>
    </>
  );
}
