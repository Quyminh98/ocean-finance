import { UserCog } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/tables/search-input";
import { RoleFilter } from "@/components/tables/role-filter";
import { Pagination } from "@/components/tables/pagination";
import { StatusChip } from "@/components/tables/status-chip";
import { RoleChip } from "@/components/tables/role-chip";
import { UserStatusToggle } from "@/components/forms/user-status-toggle";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { formatVnd, EXPENSE_TEXT_CLASS } from "@/lib/money";
import {
  listUserAccounts,
  USER_ACCOUNT_PAGE_SIZE_OPTIONS,
  type UserAccountPageSize,
} from "@/server/services/user-account.service";
import { getAdminSpendingBreakdown } from "@/server/services/dashboard.service";
import type { Role } from "@/generated/prisma/client";

type SettingsUsersSearchParams = { q?: string; role?: string; page?: string; pageSize?: string };

function parseRole(value: string | undefined): Role | undefined {
  return value === "ADMIN" || value === "USER" ? value : undefined;
}

export default async function SettingsUsersPage({
  searchParams,
}: {
  searchParams: Promise<SettingsUsersSearchParams>;
}) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, Number(params.page) || 1) : 1;
  const pageSizeCandidate = params.pageSize ? Number(params.pageSize) : 20;
  const pageSize: UserAccountPageSize = (USER_ACCOUNT_PAGE_SIZE_OPTIONS as readonly number[]).includes(
    pageSizeCandidate,
  )
    ? (pageSizeCandidate as UserAccountPageSize)
    : 20;

  const [{ items, total }, adminSpending] = await Promise.all([
    listUserAccounts({ search: params.q, role: parseRole(params.role), page, pageSize }),
    getAdminSpendingBreakdown(),
  ]);
  const totalSpentByAdminId = new Map(adminSpending.map((row) => [row.adminId, row.total]));

  const hasActiveFilter = Boolean(params.q || params.role);

  return (
    <div>
      <PageHeader title="Tài khoản" description="Quản lý role và trạng thái tài khoản đăng nhập (Admin, Nhân viên)." />

      <div className="mb-stack-md flex flex-wrap items-center justify-between gap-stack-sm">
        <SearchInput placeholder="Tìm theo tên hoặc email..." />
        <RoleFilter />
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-container-lowest">
        {items.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title={hasActiveFilter ? "Không tìm thấy tài khoản phù hợp" : "Chưa có tài khoản"}
            description={hasActiveFilter ? "Thử điều chỉnh bộ lọc." : "Danh sách tài khoản sẽ hiển thị tại đây."}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-ice hover:bg-surface-ice">
                  <TableHead className="w-12 font-label-caps text-label-caps text-on-surface-variant">STT</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Tên</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Email</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Vai trò</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Trạng thái</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Tổng đã chi</TableHead>
                  <TableHead className="font-label-caps text-label-caps text-on-surface-variant">Ngày tạo</TableHead>
                  <TableHead className="text-right font-label-caps text-label-caps text-on-surface-variant">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((account, index) => (
                  <TableRow key={account.id} className="border-border-subtle">
                    <TableCell className="font-data-tabular text-data-tabular text-on-surface-variant">{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="font-medium text-on-surface">{account.name}</TableCell>
                    <TableCell className="text-on-surface-variant">{account.email}</TableCell>
                    <TableCell>
                      <RoleChip role={account.role} />
                    </TableCell>
                    <TableCell>
                      <StatusChip status={account.status} />
                    </TableCell>
                    <TableCell className={`text-right font-data-tabular text-data-tabular ${account.role === "ADMIN" ? EXPENSE_TEXT_CLASS : "text-on-surface-variant"}`}>
                      {account.role === "ADMIN" ? formatVnd(totalSpentByAdminId.get(account.id) ?? 0n) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-data-tabular text-data-tabular text-on-surface-variant">
                      {formatDateTime(account.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <UserStatusToggle
                          userId={account.id}
                          name={account.name}
                          role={account.role}
                          status={account.status}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} pageSizeOptions={USER_ACCOUNT_PAGE_SIZE_OPTIONS} />
          </>
        )}
      </div>
    </div>
  );
}
