import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ExternalLink, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageStatusChipList } from "@/components/tables/page-status-chip-list";
import { PageTypeChip } from "@/components/tables/page-type-chip";
import { StatusChip } from "@/components/tables/status-chip";
import { SearchInput } from "@/components/tables/search-input";
import { PageFilters } from "@/components/tables/page-filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditPageStatusDialog } from "@/components/forms/edit-page-status-dialog";
import { formatVnd, EXPENSE_TEXT_CLASS } from "@/lib/money";
import { formatMonth } from "@/lib/dates";
import { requireUser } from "@/server/auth/rbac";
import { getEmployeeDetailByUserId } from "@/server/services/employee.service";
import { listPagesByEmployee } from "@/server/services/page.service";
import { listPageStatusOptions } from "@/server/services/page-status-option.service";
import { listPayouts } from "@/server/services/payout.service";
import { PAGE_TYPES } from "@/server/validators/page.schema";

type UserPagesSearchParams = { q?: string; pageType?: string; statusId?: string };

export default async function UserPagesPage({
  searchParams,
}: {
  searchParams: Promise<UserPagesSearchParams>;
}) {
  // RBAC: employeeId always resolved from session (never from a client param).
  const user = await requireUser();
  const profile = await getEmployeeDetailByUserId(user.id);
  if (!profile) notFound();

  const params = await searchParams;
  const pageType = (PAGE_TYPES as readonly string[]).includes(params.pageType ?? "")
    ? (params.pageType as (typeof PAGE_TYPES)[number])
    : undefined;

  const [items, statusOptions, payouts] = await Promise.all([
    listPagesByEmployee(profile.employeeId, { search: params.q, pageType, statusId: params.statusId }),
    listPageStatusOptions(),
    listPayouts(),
  ]);
  const statusPickerOptions = statusOptions.map((option) => ({ optionId: option.optionId, label: option.label, color: option.color }));
  const payoutPickerOptions = payouts.map((payout) => ({ payoutId: payout.payoutId, name: payout.name, status: payout.status }));
  const hasActiveFilter = Boolean(params.q || params.pageType || params.statusId);

  return (
    <div>
      <PageHeader
        title="Page của tôi"
        description="Page hiện đang phụ trách — có thể tự cập nhật trạng thái."
        action={
          <Button nativeButton={false} render={<Link href="/user/pages/new" />}>
            <Plus className="size-4" strokeWidth={2} />
            Thêm Page hệ thống
          </Button>
        }
      />

      <div className="mb-stack-md flex flex-wrap items-center justify-between gap-stack-sm">
        <SearchInput placeholder="Tìm theo tên hoặc URL..." />
        <PageFilters statusOptions={statusOptions.map((option) => ({ id: option.optionId, name: option.label }))} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={hasActiveFilter ? "Không tìm thấy Page phù hợp" : "Chưa phụ trách Page nào"}
          description={
            hasActiveFilter
              ? "Thử điều chỉnh bộ lọc hoặc từ khoá."
              : "Page được Admin gán cho bạn, hoặc Page hệ thống bạn tự thêm, sẽ hiển thị tại đây."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-ice hover:bg-surface-ice">
                <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tên Page</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Loại</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Link</TableHead>
                <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Giá mua</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tháng mua</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Trạng thái</TableHead>
                <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Payout</TableHead>
                <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row, index) => (
                <TableRow key={row.pageId} className="border-border-subtle">
                  <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{index + 1}</TableCell>
                  <TableCell className="font-medium text-on-surface">{row.name}</TableCell>
                  <TableCell>
                    <PageTypeChip pageType={row.pageType} />
                  </TableCell>
                  <TableCell>
                    <a
                      href={row.facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-on-surface-variant hover:text-finance-blue"
                    >
                      <ExternalLink className="size-3.5" strokeWidth={2} />
                      Mở link
                    </a>
                  </TableCell>
                  <TableCell className={`text-right font-data-tabular text-data-tabular ${EXPENSE_TEXT_CLASS}`}>{formatVnd(row.purchasePrice)}</TableCell>
                  <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{formatMonth(row.purchaseMonth.toISOString().slice(0, 7))}</TableCell>
                  <TableCell>
                    <PageStatusChipList statuses={row.currentStatuses} />
                  </TableCell>
                  <TableCell>
                    {row.payout ? (
                      <div className="flex items-center gap-stack-sm">
                        <span className="text-on-surface-variant">{row.payout.name}</span>
                        <StatusChip status={row.payout.status} />
                      </div>
                    ) : (
                      <span className="text-on-surface-variant">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <EditPageStatusDialog
                        pageId={row.pageId}
                        defaultValues={{
                          statusIds: row.currentStatuses.map((status) => status.statusId),
                          payoutId: row.payout?.payoutId ?? "",
                        }}
                        statusOptions={statusPickerOptions}
                        payoutOptions={payoutPickerOptions}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
