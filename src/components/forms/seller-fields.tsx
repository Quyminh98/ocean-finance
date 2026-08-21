import type { FieldErrors, FieldValues, Path, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";

type SellerFormValues = FieldValues & { name: string };

type SellerFieldsProps<T extends SellerFormValues> = {
  idPrefix: string;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
};

/** Name — shared by Create/Edit "Người bán" dialogs. */
export function SellerFields<T extends SellerFormValues>({ idPrefix, register, errors }: SellerFieldsProps<T>) {
  return (
    <Field label="Tên người bán" htmlFor={`${idPrefix}-name`} error={errors.name?.message as string | undefined}>
      <Input id={`${idPrefix}-name`} {...register("name" as Path<T>)} placeholder="Nguyễn Văn A" maxLength={100} className="h-10 rounded-lg" />
    </Field>
  );
}
