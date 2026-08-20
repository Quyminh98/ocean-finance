import { HandCoins } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/tables/pagination";
import { AdminReceiptFilters } from "@/components/tables/admin-receipt-filters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateAdminReceiptDialog } from "@/components/forms/create-admin-receipt-dialog";
import { EditAdminReceiptDialog } from "@/components/forms/edit-admin-receipt-dialog";
import { DeleteAdminReceiptButton } from "@/components/forms/delete-admin-receipt-button";
import { formatVnd, REVENUE_TEXT_CLASS } from "@/lib/money";
import { formatMonth } from "@/lib/dates";
import { listAdminReceipts, ADMIN_RECEIPT_PAGE_SIZE_OPTIONS, type AdminReceiptPageSize } from "@/server/services/receipt.service";
import { listAdminOptions } from "@/server/services/user-account.service";

type AdminReceiptsSearchParams = {
  page?: string;
  pageSize?: string;
  month?: string;
  createdByAdminId?: string;
};

export default async function AdminReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<AdminReceiptsSearchParams>;
}) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, Number(params.page) || 1) : 1;
  const pageSizeCandidate = params.pageSize ? Number(params.pageSize) : 20;
  const pageSize: AdminReceiptPageSize = (ADMIN_RECEIPT_PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeCandidate)
    ? (pageSizeCandidate as AdminReceiptPageSize)
    : 20;

  const [{ items, total }, adminOptions] = await Promise.all([
    listAdminReceipts({
      month: params.month,
      createdByAdminId: params.createdByAdminId,
      page,
      pageSize,
    }),
    listAdminOptions(),
  ]);

  const hasActiveFilter = Boolean(params.month || params.createdByAdminId);

  return (
    <div>
      <PageHeader
        title="Tiền Admin đã nhận"
        description="Tổng tiền thực tế Admin đã nhận — tách biệt với doanh thu Page, không được đồng nhất trong tính toán."
        action={<CreateAdminReceiptDialog adminOptions={adminOptions} />}
      />

      <div className="mb-stack-md flex flex-wrap items-center justify-between gap-stack-sm">
        <AdminReceiptFilters adminOptions={adminOptions.map((a) => ({ id: a.adminId, name: a.name }))} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {items.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title={hasActiveFilter ? "Không tìm thấy khoản nhận phù hợp" : "Chưa có khoản nhận nào"}
            description={hasActiveFilter ? "Thử điều chỉnh bộ lọc." : "Bấm “Thêm khoản nhận” để ghi nhận khoản Admin đã nhận đầu tiên."}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-ice hover:bg-surface-ice">
                  <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tháng nhận</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Nguồn / mô tả</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Số tiền</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Admin nhận</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Admin nhập</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ghi chú</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, index) => (
                  <TableRow key={row.adminReceiptId} className="border-border-subtle">
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">
                      {formatMonth(row.receiptMonth.toISOString().slice(0, 7))}
                    </TableCell>
                    <TableCell className="font-medium text-on-surface">{row.source}</TableCell>
                    <TableCell className={`text-right font-data-tabular text-data-tabular ${REVENUE_TEXT_CLASS}`}>{formatVnd(row.amount)}</TableCell>
                    <TableCell className="text-on-surface-variant">{row.receivedByAdminName}</TableCell>
                    <TableCell className="text-on-surface-variant">{row.createdByAdminName}</TableCell>
                    <TableCell className="text-on-surface-variant">{row.note ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-stack-sm">
                        <EditAdminReceiptDialog
                          adminReceiptId={row.adminReceiptId}
                          defaultValues={{
                            receiptMonth: row.receiptMonth.toISOString().slice(0, 7),
                            amount: row.amount.toString(),
                            source: row.source,
                            note: row.note ?? "",
                            receivedByAdminId: row.receivedByAdminId,
                          }}
                          adminOptions={adminOptions}
                        />
                        <DeleteAdminReceiptButton adminReceiptId={row.adminReceiptId} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} pageSizeOptions={ADMIN_RECEIPT_PAGE_SIZE_OPTIONS} />
          </>
        )}
      </div>
    </div>
  );
}
