"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export function SidebarNavItem({ href, label, icon }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-r border-l-2 px-4 py-2 font-body-md text-body-md transition-colors",
        isActive
          ? "border-finance-blue bg-sidebar-accent text-on-surface font-semibold"
          : "border-transparent text-on-surface-variant hover:border-outline-variant hover:text-on-surface",
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
