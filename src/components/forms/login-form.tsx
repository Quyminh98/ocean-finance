"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { loginAction, type LoginState } from "@/server/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-10 w-full rounded-lg bg-ink text-on-primary hover:bg-ink/90">
      {pending ? "Đang đăng nhập..." : "Đăng nhập"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex w-full flex-col gap-5">
      {state?.error ? (
        <div className="rounded-lg border border-error-red/20 bg-error-container/30 p-3 font-body-md text-body-md text-error-red">
          {state.error}
        </div>
      ) : null}

      <div className="flex flex-col gap-stack-sm">
        <Label htmlFor="email" className="font-label-caps text-label-caps uppercase text-on-surface">
          Email
        </Label>
        <Input id="email" name="email" type="email" placeholder="admin@company.com" required autoComplete="email" className="h-10 rounded-lg" />
      </div>

      <div className="flex flex-col gap-stack-sm">
        <Label htmlFor="password" className="font-label-caps text-label-caps uppercase text-on-surface">
          Mật khẩu
        </Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="h-10 rounded-lg pr-10"
          />
          <button
            type="button"
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-on-surface"
          >
            {showPassword ? <EyeOff className="size-4" strokeWidth={2} /> : <Eye className="size-4" strokeWidth={2} />}
          </button>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
