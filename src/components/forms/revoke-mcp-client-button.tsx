"use client";

import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { revokeMcpClientAction } from "@/server/actions/mcp-client.actions";

type RevokeMcpClientButtonProps = {
  clientId: string;
  clientName: string;
};

export function RevokeMcpClientButton({ clientId, clientName }: RevokeMcpClientButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Ban className="size-3.5" strokeWidth={2} />
          Thu hồi
        </Button>
      }
      title="Thu hồi API key"
      description={`"${clientName}" sẽ không thể xác thực với MCP server nữa. Hành động này không thể hoàn tác — nếu cần dùng lại, hãy tạo một key mới.`}
      confirmLabel="Thu hồi"
      onConfirm={() => revokeMcpClientAction(clientId)}
    />
  );
}
