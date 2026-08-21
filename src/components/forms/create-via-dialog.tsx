"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
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
import { ViaFields } from "@/components/forms/via-fields";
import { ViaPagePicker } from "@/components/forms/via-page-picker";
import { createViaAction, type CreateViaState } from "@/server/actions/via.actions";
import { CreateViaClientSchema, type CreateViaFormValues } from "@/server/validators/via.schema";
import type { PageOption } from "@/server/services/page.service";

const defaultValues: CreateViaFormValues = { name: "", facebookUrl: "", pageIds: [] };

type CreateViaDialogProps = {
  pageOptions: PageOption[];
};

export function CreateViaDialog({ pageOptions }: CreateViaDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<CreateViaState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateViaFormValues>({ resolver: zodResolver(CreateViaClientSchema), defaultValues });

  function onSubmit(values: CreateViaFormValues) {
    startTransition(async () => {
      const result = await createViaAction(values);
      if (result.status === "error") {
        setActionState(result);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset(defaultValues);
          setActionState(undefined);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" strokeWidth={2} />
            Thêm via
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm via</DialogTitle>
          <DialogDescription>Via tạo ra sẽ do chính bạn cầm.</DialogDescription>
        </DialogHeader>

        <form id="create-via-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <ViaFields idPrefix="create-via" register={register} errors={errors} />
          <ViaPagePicker idPrefix="create-via" control={control} errors={errors} options={pageOptions} />
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="create-via-form" disabled={isPending}>
            {isPending ? "Đang tạo..." : "Tạo via"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
