"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { createMcpClientAction, type CreateMcpClientState } from "@/server/actions/mcp-client.actions";
import {
  CreateMcpClientClientSchema,
  type CreateMcpClientFormValues,
} from "@/server/validators/mcp-client.schema";

export function CreateMcpClientDialog() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CreateMcpClientState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateMcpClientFormValues>({
    resolver: zodResolver(CreateMcpClientClientSchema),
    defaultValues: { name: "" },
  });

  function onSubmit(values: CreateMcpClientFormValues) {
    startTransition(async () => {
      setState(await createMcpClientAction(values));
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({ name: "" });
      setState(undefined);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-3.5" strokeWidth={2} />
            Tạo API key mới
          </Button>
        }
      />
      <DialogContent>
        {state?.status === "success" ? (
          <CreateMcpClientSuccess apiKey={state.apiKey} onDone={() => setOpen(false)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Tạo MCP / API key mới</DialogTitle>
              <DialogDescription>
                Key được cấp quyền tương đương Admin. Đặt tên gợi nhớ (VD: “Claude Code — máy làm việc”) để dễ nhận
                diện khi cần thu hồi sau này.
              </DialogDescription>
            </DialogHeader>

            <form id="create-mcp-client-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
              {state?.status === "error" && !state.fieldErrors ? (
                <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
                  {state.error}
                </div>
              ) : null}

              <Field
                label="Tên client"
                htmlFor="mcp-client-name"
                error={errors.name?.message ?? (state?.status === "error" ? state.fieldErrors?.name : undefined)}
              >
                <Input
                  id="mcp-client-name"
                  {...register("name")}
                  placeholder="Claude Code — máy làm việc"
                  className="h-10 rounded-lg"
                />
              </Field>
            </form>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
              <Button type="submit" form="create-mcp-client-form" disabled={isPending}>
                {isPending ? "Đang tạo..." : "Tạo key"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateMcpClientSuccess({ apiKey, onDone }: { apiKey: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-stack-sm">
          <div className="flex size-10 items-center justify-center rounded-full bg-surface-ice text-success-green">
            <KeyRound className="size-5" strokeWidth={2} />
          </div>
          <DialogTitle>Đã tạo API key</DialogTitle>
        </div>
        <DialogDescription>
          Key dưới đây chỉ hiển thị một lần. Hãy sao chép và lưu vào nơi an toàn — hệ thống sẽ không hiện lại
          plaintext, kể cả khi bạn tải lại trang này.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center justify-between gap-stack-sm rounded-lg border border-border-subtle bg-surface-container px-3 py-2">
        <code className="break-all font-data-tabular text-data-tabular text-on-surface">{apiKey}</code>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
          {copied ? <Check className="size-3.5" strokeWidth={2} /> : <Copy className="size-3.5" strokeWidth={2} />}
          {copied ? "Đã sao chép" : "Sao chép"}
        </Button>
      </div>

      <DialogFooter>
        <Button onClick={onDone}>Đã lưu, đóng lại</Button>
      </DialogFooter>
    </>
  );
}
