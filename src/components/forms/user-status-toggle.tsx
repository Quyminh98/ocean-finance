"use client";

import { UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { setUserAccountStatusAction } from "@/server/actions/user-account.actions";
import type { Role, UserStatus } from "@/generated/prisma/client";

type UserStatusToggleProps = {
  userId: string;
  name: string;
  role: Role;
  status: UserStatus;
};

/** Deactivate/Reactivate toggle for Settings — User Accounts (plan Phase 13), server-guarded against locking out the last active Admin. */
export function UserStatusToggle({ userId, name, role, status }: UserStatusToggleProps) {
  if (status === "ACTIVE") {
    return (
      <ConfirmDialog
        trigger={
          <Button variant="destructive" size="sm">
            <UserX className="size-3.5" strokeWidth={2} />
            Vô hiệu hoá
          </Button>
        }
        title={role === "ADMIN" ? "Vô hiệu hoá tài khoản Admin" : "Vô hiệu hoá tài khoản"}
        description={`${name} sẽ không thể đăng nhập được nữa. Toàn bộ lịch sử liên quan vẫn được giữ nguyên.`}
        confirmLabel="Vô hiệu hoá"
        onConfirm={() => setUserAccountStatusAction(userId, "INACTIVE")}
      />
    );
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <UserCheck className="size-3.5" strokeWidth={2} />
          Kích hoạt
        </Button>
      }
      title="Kích hoạt lại tài khoản"
      description={`${name} sẽ có thể đăng nhập trở lại.`}
      confirmLabel="Kích hoạt"
      destructive={false}
      onConfirm={() => setUserAccountStatusAction(userId, "ACTIVE")}
    />
  );
}
