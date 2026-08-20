import { PageHeader } from "@/components/shared/page-header";
import { CreateSystemPageForm } from "@/components/forms/create-system-page-form";
import { listPageStatusOptions } from "@/server/services/page-status-option.service";

export default async function NewSystemPagePage() {
  const statusOptions = await listPageStatusOptions();

  return (
    <div>
      <PageHeader
        title="Thêm Page hệ thống"
        description="Tự thêm Page hệ thống vào account bạn quản lý — không cần giá mua, tự động gán cho chính bạn."
      />
      <CreateSystemPageForm
        statusOptions={statusOptions.map((option) => ({ optionId: option.optionId, label: option.label, color: option.color }))}
      />
    </div>
  );
}
