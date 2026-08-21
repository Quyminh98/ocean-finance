import { PageHeader } from "@/components/shared/page-header";
import { CreateSystemPageForm } from "@/components/forms/create-system-page-form";
import { listPageStatusOptions } from "@/server/services/page-status-option.service";
import { listPayouts } from "@/server/services/payout.service";

export default async function NewSystemPagePage() {
  const [statusOptions, payouts] = await Promise.all([listPageStatusOptions(), listPayouts()]);

  return (
    <div>
      <PageHeader
        title="Thêm Page hệ thống"
        description="Tự thêm Page hệ thống vào account bạn quản lý — không cần giá mua, tự động gán cho chính bạn."
      />
      <CreateSystemPageForm
        statusOptions={statusOptions.map((option) => ({ optionId: option.optionId, label: option.label, color: option.color }))}
        payouts={payouts.map((payout) => ({ payoutId: payout.payoutId, name: payout.name, status: payout.status }))}
      />
    </div>
  );
}
