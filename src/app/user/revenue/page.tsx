import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SearchInput } from "@/components/tables/search-input";
import { MonthFilter } from "@/components/tables/month-filter";
import { Pagination } from "@/components/tables/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd, REVENUE_TEXT_CLASS } from "@/lib/money";
import { formatMonth } from "@/lib/dates";
import { requireUser } from "@/server/auth/rbac";
import { getEmployeeDetailByUserId, getEmployeeFinancials } from "@/server/services/employee.service";
import { listRevenue, REVENUE_PAGE_SIZE_OPTIONS, type RevenuePageSize } from "@/server/services/revenue.service";

type UserRevenueSearchParams = { q?: string; page?: string; pageSize?: string; month?: string };

export default async function UserRevenuePage({
  searchParams,
}: {
  searchParams: Promise<UserRevenueSearchParams>;
}) {
  // RBAC: employeeId always resolved from session, `listRevenue` is scoped to
  // it explicitly — the client cannot pass an employeeId to see someone else's data.
  const user = await requireUser();
  const profile = await getEmployeeDetailByUserId(user.id);
  if (!profile) notFound();

  const params = await searchParams;
  const page = params.page ? Math.max(1, Number(params.page) || 1) : 1;
  const pageSizeCandidate = params.pageSize ? Number(params.pageSize) : 20;
  const pageSize: RevenuePageSize = (REVENUE_PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeCandidate)
    ? (pageSizeCandidate as RevenuePageSize)
    : 20;

  const [{ items, total }, financials] = await Promise.all([
    listRevenue({
      employeeId: profile.employeeId,
      search: params.q,
      month: params.month,
      page,
      pageSize,
    }),
    // Chỉ theo filter Tháng — filter Tìm kiếm chỉ để lọc dòng trong bảng,
    // không đổi định nghĩa "Tổng doanh thu" (dùng chung công thức với Employee
    // Detail/Employee List phía Admin, tránh lệch số giữa 2 nơi).
    getEmployeeFinancials(profile.employeeId, params.month),
  ]);
  const hasActiveFilter = Boolean(params.q || params.month);

  return (
    <div>
      <PageHeader title="Doanh thu của tôi" description="Doanh thu được ghi nhận cho các Page bạn phụ trách." />

      <div className="mb-gutter grid grid-cols-1 md:grid-cols-3">
        <KpiCard
          label="Tổng doanh thu"
          value={financials.revenue}
          tone="revenue"

        />
      </div>

      <div className="mb-stack-md flex flex-wrap items-center justify-between gap-stack-sm">
        <SearchInput placeholder="Tìm theo tên Page hoặc ghi chú..." />
        <MonthFilter />
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={hasActiveFilter ? "Không tìm thấy doanh thu phù hợp" : "Chưa có doanh thu"}
            description={hasActiveFilter ? "Thử điều chỉnh bộ lọc hoặc từ khoá." : "Doanh thu ghi nhận cho Page bạn phụ trách sẽ hiển thị tại đây."}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-ice hover:bg-surface-ice">
                  <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Page</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tháng</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Số tiền</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((revenue, index) => (
                  <TableRow key={revenue.revenueId} className="border-border-subtle">
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="font-medium text-on-surface">{revenue.pageName}</TableCell>
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{formatMonth(revenue.revenueMonth.toISOString().slice(0, 7))}</TableCell>
                    <TableCell className={`text-right font-data-tabular text-data-tabular ${REVENUE_TEXT_CLASS}`}>{formatVnd(revenue.amount)}</TableCell>
                    <TableCell className="text-on-surface-variant">{revenue.note ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} pageSizeOptions={REVENUE_PAGE_SIZE_OPTIONS} />
          </>
        )}
      </div>
    </div>
  );
}
