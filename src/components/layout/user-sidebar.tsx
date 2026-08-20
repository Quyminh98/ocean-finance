import Image from "next/image";
import { userNavItems } from "@/lib/nav-config";
import { SidebarNavItem } from "@/components/layout/nav-item";
import { SidebarLogoutButton } from "@/components/layout/sidebar-logout-button";

/** Nav content shared between the fixed desktop `UserSidebar` and the mobile `MobileSidebar` Sheet. */
export function UserSidebarContent() {
  return (
    <>
      <div className="mb-8 px-6">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Ocean Finance" width={32} height={32} className="rounded-full" priority />
          <div>
            <h1 className="font-headline-md text-headline-sm font-semibold text-on-surface">Ocean Finance</h1>
            <p className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant">Nhân viên</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-2">
        {userNavItems.map((item) => (
          <SidebarNavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={<item.icon className="size-4" strokeWidth={2} />}
          />
        ))}
      </div>

      <div className="px-6">
        <SidebarLogoutButton />
      </div>
    </>
  );
}

/**
 * User sidebar (user request 2026-08-19: "chuyển tab sang sidebar trái giống
 * admin") — same left-sidebar layout as Admin's `Sidebar`, reusing the same
 * `SidebarNavItem` component, just backed by the flat `userNavItems` list
 * (no group headers — only 6 items, doesn't need Admin's category grouping).
 * Desktop-only (lg+); mobile/tablet use `MobileSidebar`.
 */
export function UserSidebar() {
  return (
    <nav className="fixed left-0 top-0 z-20 hidden h-screen w-65 flex-col border-r border-border-subtle bg-sidebar py-gutter lg:flex">
      <UserSidebarContent />
    </nav>
  );
}
