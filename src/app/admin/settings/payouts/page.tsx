import { Landmark } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusChip } from "@/components/tables/status-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreatePayoutDialog } from "@/components/forms/create-payout-dialog";
import { EditPayoutDialog } from "@/components/forms/edit-payout-dialog";
import { DeletePayoutButton } from "@/components/forms/delete-payout-button";
import { listPayoutsWithUsage } from "@/server/services/payout.service";

export default async function PayoutsPage() {
  const payouts = await listPayoutsWithUsage();

  return (
    <div>
      <PageHeader
        title="Payout"
        description="Định nghĩa tên payout, tên bank và trạng thái một lần — khi tạo/sửa Page, chỉ cần chọn từ danh sách này."
        action={<CreatePayoutDialog />}
      />

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {payouts.length === 0 ? (
          <EmptyState icon={Landmark} title="Chưa có payout" description="Bấm “Thêm payout” để tạo payout đầu tiên." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-ice hover:bg-surface-ice">
                <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tên payout</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tên bank</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Trạng thái</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ghi chú</TableHead>
                <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Đang dùng</TableHead>
                <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout, index) => (
                <TableRow key={payout.payoutId} className="border-border-subtle">
                  <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                  <TableCell className="font-medium text-on-surface">{payout.name}</TableCell>
                  <TableCell className="text-on-surface-variant">{payout.bankName}</TableCell>
                  <TableCell>
                    <StatusChip status={payout.status} />
                  </TableCell>
                  <TableCell className="text-on-surface-variant">{payout.note ?? "—"}</TableCell>
                  <TableCell className="text-right font-data-tabular text-data-tabular text-on-surface-variant">
                    {payout.pageCount} Page
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-stack-sm">
                      <EditPayoutDialog
                        payoutId={payout.payoutId}
                        defaultValues={{ name: payout.name, bankName: payout.bankName, status: payout.status, note: payout.note ?? "" }}
                      />
                      <DeletePayoutButton payoutId={payout.payoutId} name={payout.name} inUseCount={payout.pageCount} />
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
