import { UserSidebar } from "@/components/layout/user-sidebar";
import { UserTopbar } from "@/components/layout/user-topbar";
import { PageTransition } from "@/components/layout/page-transition";
import { requireUser } from "@/server/auth/rbac";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="min-h-screen bg-surface">
      <UserSidebar />
      <UserTopbar />
      <main className="px-4 pb-20 pt-24 lg:ml-65 lg:px-container-margin">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
