import Image from "next/image";
import { adminNavGroups } from "@/lib/nav-config";
import { SidebarNavItem } from "@/components/layout/nav-item";
import { SidebarLogoutButton } from "@/components/layout/sidebar-logout-button";

/** Nav content shared between the fixed desktop `Sidebar` and the mobile `MobileSidebar` Sheet. */
export function SidebarContent() {
  return (
    <>
      <div className="mb-8 px-6">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Ocean Finance" width={32} height={32} className="rounded-full" priority />
          <h1 className="font-headline-md text-headline-sm font-semibold text-on-surface">Ocean Finance</h1>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-2">
        {adminNavGroups.map((group, index) => (
          <div key={group.label ?? `group-${index}`} className="space-y-1">
            {group.label ? (
              <p className="px-4 pb-1 font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant">
                {group.label}
              </p>
            ) : null}
            {group.items.map((item) => (
              <SidebarNavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={<item.icon className="size-4" strokeWidth={2} />}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="px-6">
        <SidebarLogoutButton />
      </div>
    </>
  );
}

/** Admin sidebar — light "surface" canvas per DESIGN.md "Sidebar" component. Desktop-only (lg+); mobile/tablet use `MobileSidebar`. */
export function Sidebar() {
  return (
    <nav className="fixed left-0 top-0 z-20 hidden h-screen w-65 flex-col border-r border-border-subtle bg-sidebar py-gutter lg:flex">
      <SidebarContent />
    </nav>
  );
}
