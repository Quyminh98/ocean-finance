"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/server/auth/actions";

/** Functional logout button for the bottom of a sidebar nav — calls the same Server Action as `LogoutMenuItem` (dropdown variant), just outside a DropdownMenu context. */
export function SidebarLogoutButton() {
  return (
    <button
      type="button"
      onClick={() => void logoutAction()}
      className="flex w-full items-center gap-3 rounded px-4 py-2 font-label-caps text-label-caps text-on-surface-variant transition-colors hover:text-on-surface"
    >
      <LogOut className="size-4" strokeWidth={2} />
      Đăng xuất
    </button>
  );
}
