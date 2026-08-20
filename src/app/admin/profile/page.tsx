import { PageHeader } from "@/components/shared/page-header";
import { formatVnd, REVENUE_TEXT_CLASS, EXPENSE_TEXT_CLASS, profitTextClass } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/rbac";
import { prisma } from "@/lib/db";
import { getAdminSpendingBreakdown } from "@/server/services/dashboard.service";

export default async function AdminProfilePage() {
  // RBAC: always resolve via the session's own userId — never accept an
  // adminId from the client (CLAUDE.md "User chỉ xem dữ liệu của chính mình",
  // applies symmetrically to Admin viewing their own profile).
  const admin = await requireAdmin();

  const [account, spendingRows] = await Promise.all([
    prisma.user.findUnique({ where: { id: admin.id }, select: { createdAt: true } }),
    getAdminSpendingBreakdown(),
  ]);
  const spending = spendingRows.find((row) => row.adminId === admin.id);

  return (
    <div>
      <PageHeader title="Hồ sơ của tôi" description="Thông tin tài khoản và tổng hợp tài chính." />

      <div className="max-w-md rounded-lg border border-border-subtle bg-surface-container-lowest p-card-padding">
        <dl className="space-y-stack-md">
          <ProfileRow label="Họ tên" value={admin.name} />
          <ProfileRow label="Email" value={admin.email} />
          {account ? <ProfileRow label="Ngày tạo tài khoản" value={formatDate(account.createdAt)} /> : null}
          <ProfileRow label="Tiền đã nhận (tất cả thời gian)" value={formatVnd(spending?.receivedAmount ?? 0n)} tone={REVENUE_TEXT_CLASS} />
          <ProfileRow label="Tổng đã chi (tất cả thời gian)" value={formatVnd(spending?.total ?? 0n)} tone={EXPENSE_TEXT_CLASS} />
          <ProfileRow label="Lợi nhuận (tất cả thời gian)" value={formatVnd(spending?.profit ?? 0n)} tone={profitTextClass(spending?.profit ?? 0n)} />
        </dl>
      </div>
    </div>
  );
}

function ProfileRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border-subtle pb-stack-sm last:border-0 last:pb-0">
      <dt className="font-label-caps text-label-caps uppercase text-on-surface-variant">{label}</dt>
      <dd className={cn("font-body-md text-body-md", tone ?? "text-on-surface")}>{value}</dd>
    </div>
  );
}
