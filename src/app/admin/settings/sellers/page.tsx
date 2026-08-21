import { Store } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateSellerDialog } from "@/components/forms/create-seller-dialog";
import { EditSellerDialog } from "@/components/forms/edit-seller-dialog";
import { DeleteSellerButton } from "@/components/forms/delete-seller-button";
import { listSellersWithUsage } from "@/server/services/seller.service";

export default async function SellersPage() {
  const sellers = await listSellersWithUsage();

  return (
    <div>
      <PageHeader
        title="Người bán"
        description="Định nghĩa tên một lần — khi tạo Page BKT, chỉ cần chọn từ danh sách này."
        action={<CreateSellerDialog />}
      />

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {sellers.length === 0 ? (
          <EmptyState icon={Store} title="Chưa có người bán" description="Bấm “Thêm người bán” để tạo người bán đầu tiên." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-ice hover:bg-surface-ice">
                <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tên</TableHead>
                <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Đang dùng</TableHead>
                <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((seller, index) => (
                <TableRow key={seller.sellerId} className="border-border-subtle">
                  <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                  <TableCell className="font-medium text-on-surface">{seller.name}</TableCell>
                  <TableCell className="text-right font-data-tabular text-data-tabular text-on-surface-variant">
                    {seller.pageCount} Page
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-stack-sm">
                      <EditSellerDialog sellerId={seller.sellerId} defaultValues={{ name: seller.name }} />
                      <DeleteSellerButton sellerId={seller.sellerId} name={seller.name} inUseCount={seller.pageCount} />
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
