import { z } from "zod";

export const CreateMcpClientSchema = z.object({
  name: z.string().trim().min(1, { error: "Vui lòng nhập tên." }).max(200),
});

export const CreateMcpClientClientSchema = CreateMcpClientSchema;

export type CreateMcpClientFormValues = z.infer<typeof CreateMcpClientClientSchema>;
