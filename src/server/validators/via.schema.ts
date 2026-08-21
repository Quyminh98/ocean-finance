import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(1, { error: "Vui lòng nhập tên via." })
  .max(100, { error: "Tên tối đa 100 ký tự." });

const facebookUrlSchema = z
  .string()
  .trim()
  .pipe(z.url({ error: "Facebook URL không hợp lệ." }));

// FKs → Page — a Via can be attached to several Pages at once (user request
// 2026-08-20, "1 page ở nhiều via được không, tôi muốn thế" — the inverse
// side of the same many-to-many). Not restricted to Pages the holder
// manages. Client-side stays a plain array (form always supplies one, even
// empty) — same input/output-parity reasoning as statusIdsInputSchema.
export const pageIdsInputSchema = z.array(z.uuid());
export const pageIdsSchema = pageIdsInputSchema.optional().transform((value) => value ?? []);

export const CreateViaSchema = z.object({ name: nameSchema, facebookUrl: facebookUrlSchema, pageIds: pageIdsSchema });
export const CreateViaClientSchema = z.object({ name: nameSchema, facebookUrl: facebookUrlSchema, pageIds: pageIdsInputSchema });
export type CreateViaFormValues = z.infer<typeof CreateViaClientSchema>;

export const UpdateViaSchema = CreateViaSchema;
export const UpdateViaClientSchema = CreateViaClientSchema;
export type UpdateViaFormValues = z.infer<typeof UpdateViaClientSchema>;
