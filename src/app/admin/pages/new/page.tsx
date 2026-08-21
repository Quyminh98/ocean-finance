import { PageHeader } from "@/components/shared/page-header";
import { CreatePageForm } from "@/components/forms/create-page-form";
import { listActiveEmployeeOptions } from "@/server/services/employee.service";
import { listAdminOptions } from "@/server/services/user-account.service";
import { listPageStatusOptions } from "@/server/services/page-status-option.service";
import { listSellers } from "@/server/services/seller.service";
import { listPayouts } from "@/server/services/payout.service";

export default async function NewPagePage() {
  const [employees, adminOptions, statusOptions, sellers, payouts] = await Promise.all([
    listActiveEmployeeOptions(),
    listAdminOptions(),
    listPageStatusOptions(),
    listSellers(),
    listPayouts(),
  ]);

  return (
    <div>
      <PageHeader title="Thêm Page" description="Tạo Page mới và gán nhân viên phụ trách ban đầu." />
      <CreatePageForm
        employees={employees}
        adminOptions={adminOptions}
        statusOptions={statusOptions.map((option) => ({ optionId: option.optionId, label: option.label, color: option.color }))}
        sellers={sellers}
        payouts={payouts.map((payout) => ({ payoutId: payout.payoutId, name: payout.name, status: payout.status }))}
      />
    </div>
  );
}
