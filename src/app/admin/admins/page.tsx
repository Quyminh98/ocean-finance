import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd, REVENUE_TEXT_CLASS, EXPENSE_TEXT_CLASS, profitTextClass } from "@/lib/money";
import { getAdminSpendingBreakdown } from "@/server/services/dashboard.service";

// All-time, no pagination/filter — same precedent as McpClient/PageStatusOption
// lists (CLAUDE.md "ưu tiên đơn giản"): quy mô cố định 2 Admin, không cần.
export default async function AdminsPage() {
  const rows = await getAdminSpendingBreakdown();

  return (
    <div>
      <PageHeader title="Quản lý Admin" description="Danh sách Admin cùng tổng tiền đã nhận/đã chi tất cả thời gian." />

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Chưa có Admin nào" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-ice hover:bg-surface-ice">
                <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tên</TableHead>
                <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Tiền đã nhận</TableHead>
                <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Tổng đã chi</TableHead>
                <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Lợi nhuận</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.adminId} className="border-border-subtle">
                  <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                  <TableCell>
                    <Link href={`/admin/admins/${row.adminId}`} className="font-medium text-on-surface hover:text-finance-blue">
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell className={`text-right font-data-tabular text-data-tabular ${REVENUE_TEXT_CLASS}`}>
                    {formatVnd(row.receivedAmount)}
                  </TableCell>
                  <TableCell className={`text-right font-data-tabular text-data-tabular ${EXPENSE_TEXT_CLASS}`}>
                    {formatVnd(row.total)}
                  </TableCell>
                  <TableCell className={`text-right font-data-tabular text-data-tabular ${profitTextClass(row.profit)}`}>
                    {formatVnd(row.profit)}
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
