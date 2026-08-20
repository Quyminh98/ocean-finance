"use client";

import { LogOut } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/server/auth/actions";

export function LogoutMenuItem() {
  return (
    <DropdownMenuItem variant="destructive" onClick={() => void logoutAction()}>
      <LogOut className="size-4" strokeWidth={2} />
      Đăng xuất
    </DropdownMenuItem>
  );
}
