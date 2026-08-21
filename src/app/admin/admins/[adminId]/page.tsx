import Link from "next/link";
import { notFound } from "next/navigation";
import { Wallet, HandCoins, IdCard, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SummaryStat } from "@/components/shared/summary-stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatVnd, REVENUE_TEXT_CLASS, EXPENSE_TEXT_CLASS, profitTextClass } from "@/lib/money";
import { formatDate, formatMonth } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getAdminSpendingBreakdown } from "@/server/services/dashboard.service";
import { listAdExpenses } from "@/server/services/ads.service";
import { listAdminExpenses } from "@/server/services/admin-expense.service";
import { listAdminReceipts } from "@/server/services/receipt.service";
import { listPagePurchaseExpensesByAdmin } from "@/server/services/page.service";
import { listActiveSalariesByAdmin } from "@/server/services/salary.service";
import { listViasByHolder } from "@/server/services/via.service";

type AdminCostDetailRow = {
  key: string;
  type: "Ads" | "Mua Page" | "Lương" | "Chi phí chung";
  label: string;
  href: string | null;
  sortDate: Date;
  amount: bigint;
  note: string | null;
};

export default async function AdminDetailPage({ params }: { params: Promise<{ adminId: string }> }) {
  const { adminId } = await params;

  const [account, spendingRows] = await Promise.all([
    prisma.user.findUnique({ where: { id: adminId }, select: { name: true, email: true, role: true, createdAt: true } }),
    getAdminSpendingBreakdown(),
  ]);
  if (!account || account.role !== "ADMIN") notFound();

  const [adExpenses, pagePurchaseExpenses, activeSalaries, adminExpenses, adminReceipts, vias] = await Promise.all([
    listAdExpenses({ paidByAdminId: adminId, pageSize: 100 }),
    listPagePurchaseExpensesByAdmin(adminId),
    listActiveSalariesByAdmin(adminId),
    listAdminExpenses({ paidByAdminId: adminId, pageSize: 100 }),
    listAdminReceipts({ receivedByAdminId: adminId, pageSize: 100 }),
    listViasByHolder(adminId),
  ]);

  // getAdminSpendingBreakdown() always includes every Admin, even one with
  // all-zero rows — find() never falls through to undefined here, but the
  // `?? 0n` fallbacks below stay as a defensive floor (same as /admin/profile).
  const spending = spendingRows.find((row) => row.adminId === adminId);

  const costRows: AdminCostDetailRow[] = [
    ...adExpenses.items.map((row) => ({
      key: `ads-${row.adExpenseId}`,
      type: "Ads" as const,
      label: row.employeeName,
      href: `/admin/employees/${row.employeeId}`,
      sortDate: row.expenseMonth,
      amount: row.amount,
      note: row.note,
    })),
    ...pagePurchaseExpenses.map((row) => ({
      key: `purchase-${row.pageId}`,
      type: "Mua Page" as const,
      label: row.pageName,
      href: `/admin/pages/${row.pageId}`,
      sortDate: row.purchaseMonth,
      amount: row.amount,
      note: null,
    })),
    ...activeSalaries.map((row) => ({
      key: `salary-${row.id}`,
      type: "Lương" as const,
      label: row.employeeName,
      href: `/admin/employees/${row.employeeId}`,
      sortDate: row.effectiveFrom,
      amount: row.monthlySalary,
      note: null,
    })),
    ...adminExpenses.items.map((row) => ({
      key: `expense-${row.adminExpenseId}`,
      type: "Chi phí chung" as const,
      label: row.description,
      href: null,
      sortDate: row.expenseDate,
      amount: row.amount,
      note: row.note,
    })),
  ].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

  return (
    <div>
      <PageHeader
        title={account.name}
        description={`${account.email} · Admin từ ${formatDate(account.createdAt)}`}
        backHref="/admin/admins"
      />

      <div className="mb-gutter grid grid-cols-2 gap-4 md:grid-cols-3">
        <SummaryStat label="Tiền đã nhận" value={formatVnd(spending?.receivedAmount ?? 0n)} tone={REVENUE_TEXT_CLASS} />
        <SummaryStat label="Tổng đã chi" value={formatVnd(spending?.total ?? 0n)} tone={EXPENSE_TEXT_CLASS} />
        <SummaryStat
          label="Lợi nhuận"
          value={formatVnd(spending?.profit ?? 0n)}
          tone={profitTextClass(spending?.profit ?? 0n)}
        />
      </div>

      <Tabs defaultValue="spending">
        <TabsList>
          <TabsTrigger value="spending">Chi tiết đã chi</TabsTrigger>
          <TabsTrigger value="received">Chi tiết đã nhận</TabsTrigger>
          <TabsTrigger value="via">Via</TabsTrigger>
        </TabsList>

        <TabsContent value="spending" className="pt-stack-md">
          {costRows.length === 0 ? (
            <EmptyState icon={Wallet} title="Chưa có khoản chi nào" description="Ads, mua Page, Lương và Chi phí chung do Admin này chi sẽ hiển thị tại đây." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-ice hover:bg-surface-ice">
                    <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Loại</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Nội dung</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tháng</TableHead>
                    <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Số tiền</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costRows.map((row, index) => (
                    <TableRow key={row.key} className="border-border-subtle">
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                      <TableCell className="text-on-surface-variant">{row.type}</TableCell>
                      <TableCell>
                        {row.href ? (
                          <Link href={row.href} className="font-medium text-on-surface hover:text-finance-blue">
                            {row.label}
                          </Link>
                        ) : (
                          row.label
                        )}
                      </TableCell>
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">
                        {formatMonth(row.sortDate.toISOString().slice(0, 7))}
                      </TableCell>
                      <TableCell className={`text-right font-data-tabular text-data-tabular ${EXPENSE_TEXT_CLASS}`}>{formatVnd(row.amount)}</TableCell>
                      <TableCell className="text-on-surface-variant">{row.note ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="received" className="pt-stack-md">
          {adminReceipts.items.length === 0 ? (
            <EmptyState icon={HandCoins} title="Chưa có khoản nhận nào" description="Tiền Admin này thực nhận sẽ hiển thị tại đây." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-ice hover:bg-surface-ice">
                    <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tháng</TableHead>
                    <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Số tiền</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Nguồn</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminReceipts.items.map((row, index) => (
                    <TableRow key={row.adminReceiptId} className="border-border-subtle">
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">
                        {formatMonth(row.receiptMonth.toISOString().slice(0, 7))}
                      </TableCell>
                      <TableCell className={`text-right font-data-tabular text-data-tabular ${REVENUE_TEXT_CLASS}`}>{formatVnd(row.amount)}</TableCell>
                      <TableCell className="text-on-surface-variant">{row.source}</TableCell>
                      <TableCell className="text-on-surface-variant">{row.note ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Read-only — Admin tự tạo/xoá via của chính mình ở "/admin/vias"
            (user request 2026-08-20 "ai tạo là người đó cầm"), trang chi
            tiết Admin khác chỉ xem lại để tra cứu, không có nút Tạo/Xoá. */}
        <TabsContent value="via" className="pt-stack-md">
          {vias.length === 0 ? (
            <EmptyState icon={IdCard} title="Chưa có via" description="Via Admin này tự tạo sẽ hiển thị tại đây." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-ice hover:bg-surface-ice">
                    <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tên via</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Link</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Page</TableHead>
                    <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ngày tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vias.map((via, index) => (
                    <TableRow key={via.viaId} className="border-border-subtle">
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                      <TableCell className="font-medium text-on-surface">{via.name}</TableCell>
                      <TableCell>
                        <a
                          href={via.facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-on-surface-variant hover:text-finance-blue"
                        >
                          <ExternalLink className="size-3.5" strokeWidth={2} />
                          Mở link
                        </a>
                      </TableCell>
                      <TableCell className="text-on-surface-variant">
                        {via.pages.length === 0 ? "—" : via.pages.map((page) => page.name).join(", ")}
                      </TableCell>
                      <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{formatDate(via.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
