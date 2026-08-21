"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
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
import { updateViaAction, type UpdateViaState } from "@/server/actions/via.actions";
import { UpdateViaClientSchema, type UpdateViaFormValues } from "@/server/validators/via.schema";
import type { PageOption } from "@/server/services/page.service";

type EditViaDialogProps = {
  viaId: string;
  defaultValues: UpdateViaFormValues;
  pageOptions: PageOption[];
};

export function EditViaDialog({ viaId, defaultValues, pageOptions }: EditViaDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<UpdateViaState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateViaFormValues>({ resolver: zodResolver(UpdateViaClientSchema), defaultValues });

  function onSubmit(values: UpdateViaFormValues) {
    startTransition(async () => {
      const result = await updateViaAction(viaId, values);
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
          <Button variant="outline" size="sm">
            <Pencil className="size-3.5" strokeWidth={2} />
            Chỉnh sửa
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa via</DialogTitle>
          <DialogDescription>Đổi tên/link/Page gắn với via này.</DialogDescription>
        </DialogHeader>

        <form id="edit-via-form" onSubmit={handleSubmit(onSubmit)} className="space-y-stack-md">
          {actionState?.status === "error" && !actionState.fieldErrors ? (
            <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
              {actionState.error}
            </div>
          ) : null}

          <ViaFields idPrefix="edit-via" register={register} errors={errors} />
          <ViaPagePicker idPrefix="edit-via" control={control} errors={errors} options={pageOptions} />
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Huỷ</DialogClose>
          <Button type="submit" form="edit-via-form" disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
