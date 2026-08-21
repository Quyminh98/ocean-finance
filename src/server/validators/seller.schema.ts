import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(1, { error: "Vui lòng nhập tên người bán." })
  .max(100, { error: "Tên tối đa 100 ký tự." });

export const CreateSellerSchema = z.object({ name: nameSchema });
export const CreateSellerClientSchema = CreateSellerSchema;
export type CreateSellerFormValues = z.infer<typeof CreateSellerClientSchema>;

export const UpdateSellerSchema = CreateSellerSchema;
export const UpdateSellerClientSchema = CreateSellerClientSchema;
export type UpdateSellerFormValues = z.infer<typeof UpdateSellerClientSchema>;
