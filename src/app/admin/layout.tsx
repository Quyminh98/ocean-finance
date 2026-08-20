import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageTransition } from "@/components/layout/page-transition";
import { requireAdmin } from "@/server/auth/rbac";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <Topbar />
      <main className="px-4 pb-20 pt-24 lg:ml-65 lg:px-container-margin">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
