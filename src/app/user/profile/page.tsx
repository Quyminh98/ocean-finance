import { PageHeader } from "@/components/shared/page-header";
import { formatVnd, EXPENSE_TEXT_CLASS } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/rbac";
import { getEmployeeDetailByUserId } from "@/server/services/employee.service";

export default async function UserProfilePage() {
  // RBAC: always resolve via the session's own userId — never accept an
  // employeeId from the client (CLAUDE.md "User chỉ xem dữ liệu của chính mình").
  const user = await requireUser();
  const profile = await getEmployeeDetailByUserId(user.id);

  if (!profile) {
    return (
      <div>
        <PageHeader title="Hồ sơ của tôi" description="Thông tin tài khoản và lương hiện hành." />
        <p className="font-body-md text-body-md text-on-surface-variant">Không tìm thấy hồ sơ nhân viên.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Hồ sơ của tôi" description="Thông tin tài khoản và lương hiện hành." />

      <div className="max-w-md rounded-lg border border-border-subtle bg-surface-container-lowest p-card-padding">
        <dl className="space-y-stack-md">
          <ProfileRow label="Họ tên" value={profile.name} />
          <ProfileRow label="Email" value={profile.email} />
          <ProfileRow label="Lương đã trả" value={formatVnd(profile.currentSalary)} tone={EXPENSE_TEXT_CLASS} />
          <ProfileRow label="Page đang quản lý" value={String(profile.activePages)} />
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
