"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deletePageAction } from "@/server/actions/page.actions";

type DeletePageButtonProps = {
  pageId: string;
  pageName: string;
};

export function DeletePageButton({ pageId, pageName }: DeletePageButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 className="size-3.5" strokeWidth={2} />
          Xoá
        </Button>
      }
      title="Xoá Page"
      description={`"${pageName}" sẽ bị ẩn khỏi danh sách (soft delete), không mất dữ liệu — lịch sử Doanh thu/Ads/Chi phí mua liên quan vẫn được giữ nguyên.`}
      confirmLabel="Xoá"
      onConfirm={() => deletePageAction(pageId)}
    />
  );
}
