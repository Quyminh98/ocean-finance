import { Palette } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageStatusChip } from "@/components/tables/page-status-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreatePageStatusOptionDialog } from "@/components/forms/create-page-status-option-dialog";
import { EditPageStatusOptionDialog } from "@/components/forms/edit-page-status-option-dialog";
import { DeletePageStatusOptionButton } from "@/components/forms/delete-page-status-option-button";
import { listPageStatusOptionsWithUsage } from "@/server/services/page-status-option.service";

export default async function PageStatusOptionsPage() {
  const options = await listPageStatusOptionsWithUsage();

  return (
    <div>
      <PageHeader
        title="Loại trạng thái Page"
        description="Định nghĩa tên và màu một lần — khi tạo/sửa Page, chỉ cần chọn từ danh sách này."
        action={<CreatePageStatusOptionDialog />}
      />

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {options.length === 0 ? (
          <EmptyState icon={Palette} title="Chưa có loại trạng thái" description="Bấm “Thêm loại” để tạo loại trạng thái đầu tiên." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-ice hover:bg-surface-ice">
                <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Xem trước</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tên loại</TableHead>
                <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Đang dùng</TableHead>
                <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {options.map((option, index) => (
                <TableRow key={option.optionId} className="border-border-subtle">
                  <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                  <TableCell>
                    <PageStatusChip status={{ label: option.label, color: option.color }} />
                  </TableCell>
                  <TableCell className="font-medium text-on-surface">{option.label}</TableCell>
                  <TableCell className="text-right font-data-tabular text-data-tabular text-on-surface-variant">
                    {option.pageCount} Page
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-stack-sm">
                      <EditPageStatusOptionDialog
                        optionId={option.optionId}
                        defaultValues={{ label: option.label, color: option.color }}
                      />
                      <DeletePageStatusOptionButton optionId={option.optionId} label={option.label} inUseCount={option.pageCount} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
