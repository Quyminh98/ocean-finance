import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/rbac";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "ADMIN" ? "/admin/dashboard" : "/user/dashboard");
}
