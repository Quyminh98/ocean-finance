import { redirect } from "next/navigation";
import Image from "next/image";
import { getCurrentUser } from "@/server/auth/rbac";
import { LoginForm } from "@/components/forms/login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "ADMIN" ? "/admin/dashboard" : "/user/dashboard");
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-surface px-4">
      <div className="flex w-full max-w-[400px] flex-col items-center gap-6">
        <div className="text-center">
          <p className="font-headline-sm text-headline-sm italic text-on-surface-variant">
            “Muốn đi riêng thì đi một mình, muốn đi chung thì đi cùng nhau”
          </p>
          <p className="mt-2 font-label-caps text-label-caps uppercase tracking-wider text-outline">
            — Người truyền nước
          </p>
        </div>
        <div className="flex w-full flex-col gap-6 rounded-lg border border-border-subtle bg-surface-container-lowest p-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <Image src="/logo.png" alt="Ocean Finance" width={72} height={72} className="mb-3 rounded-full" priority />
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Ocean Finance</h1>

          </div>
          <LoginForm />
        </div>

      </div>
    </div>
  );
}
