import { z } from "zod";

const labelSchema = z
  .string()
  .trim()
  .min(1, { error: "Vui lòng nhập tên loại trạng thái." })
  .max(30, { error: "Tên tối đa 30 ký tự." });

// Preset swatches only (CLAUDE.md — không tự đặt màu ngoài DESIGN.md); no
// free-form hex input.
export const PAGE_STATUS_COLORS = ["GRAY", "GREEN", "BLUE", "AMBER", "RED", "ORANGE", "PURPLE", "PINK"] as const;
export type PageStatusColorValue = (typeof PAGE_STATUS_COLORS)[number];
const colorSchema = z.enum(PAGE_STATUS_COLORS, { error: "Màu không hợp lệ." });

export const CreatePageStatusOptionSchema = z.object({ label: labelSchema, color: colorSchema });
export const CreatePageStatusOptionClientSchema = CreatePageStatusOptionSchema;
export type CreatePageStatusOptionFormValues = z.infer<typeof CreatePageStatusOptionClientSchema>;

export const UpdatePageStatusOptionSchema = CreatePageStatusOptionSchema;
export const UpdatePageStatusOptionClientSchema = CreatePageStatusOptionClientSchema;
export type UpdatePageStatusOptionFormValues = z.infer<typeof UpdatePageStatusOptionClientSchema>;
