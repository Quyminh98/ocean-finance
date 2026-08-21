"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { PageStatusPicker, type PageStatusPickerOption } from "@/components/forms/page-status-picker";
import { PayoutPicker, type PayoutPickerOption } from "@/components/forms/payout-picker";
import { createSystemPageForSelfAction, type CreateSystemPageSelfState } from "@/server/actions/page.actions";
import { CreateSystemPageSelfClientSchema, type CreateSystemPageSelfFormValues } from "@/server/validators/page.schema";

type CreateSystemPageFormProps = {
  statusOptions: PageStatusPickerOption[];
  payouts: PayoutPickerOption[];
};

/**
 * User self-service Create — always Page hệ thống, auto-assigned to the
 * caller. No price/payer/employee picker (unlike CreatePageForm, Admin-only)
 * since those never apply to this type/flow — Payout stays available though
 * (user request 2026-08-20, "áp dụng chọn payout cho page cả ở admin và nhân viên").
 */
export function CreateSystemPageForm({ statusOptions, payouts }: CreateSystemPageFormProps) {
  const router = useRouter();
  const [state, setState] = useState<CreateSystemPageSelfState | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateSystemPageSelfFormValues>({
    resolver: zodResolver(CreateSystemPageSelfClientSchema),
    defaultValues: { name: "", facebookUrl: "", payoutId: "", statusIds: [], notes: "" },
  });

  function onSubmit(values: CreateSystemPageSelfFormValues) {
    startTransition(async () => {
      const result = await createSystemPageForSelfAction(values);
      if (result.status === "error") {
        setState(result);
        return;
      }
      router.push("/user/pages");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-stack-md">
      {state?.status === "error" && !state.fieldErrors ? (
        <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
          {state.error}
        </div>
      ) : null}

      <Field label="Tên Page" htmlFor="name" error={errors.name?.message}>
        <Input id="name" {...register("name")} placeholder="VN_Global_Ecom_01" className="h-10 rounded-lg" />
      </Field>

      <Field
        label="Facebook URL"
        htmlFor="facebookUrl"
        error={errors.facebookUrl?.message ?? (state?.status === "error" ? state.fieldErrors?.facebookUrl : undefined)}
      >
        <Input
          id="facebookUrl"
          {...register("facebookUrl")}
          placeholder="https://facebook.com/vnglobalecom01"
          className="h-10 rounded-lg"
        />
      </Field>

      <PayoutPicker idPrefix="create-system-page" control={control} errors={errors} options={payouts} />

      <PageStatusPicker idPrefix="create-system-page" control={control} errors={errors} options={statusOptions} />

      <Field label="Ghi chú" htmlFor="notes" error={errors.notes?.message}>
        <textarea
          id="notes"
          {...register("notes")}
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </Field>

      <div className="flex items-center gap-stack-sm pt-stack-sm">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Đang tạo..." : "Tạo Page"}
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/user/pages" />}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}
