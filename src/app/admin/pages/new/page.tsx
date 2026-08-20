import { PageHeader } from "@/components/shared/page-header";
import { CreatePageForm } from "@/components/forms/create-page-form";
import { listActiveEmployeeOptions } from "@/server/services/employee.service";
import { listAdminOptions } from "@/server/services/user-account.service";
import { listPageStatusOptions } from "@/server/services/page-status-option.service";

export default async function NewPagePage() {
  const [employees, adminOptions, statusOptions] = await Promise.all([
    listActiveEmployeeOptions(),
    listAdminOptions(),
    listPageStatusOptions(),
  ]);

  return (
    <div>
      <PageHeader title="Thêm Page" description="Tạo Page mới và gán nhân viên phụ trách ban đầu." />
      <CreatePageForm
        employees={employees}
        adminOptions={adminOptions}
        statusOptions={statusOptions.map((option) => ({ optionId: option.optionId, label: option.label, color: option.color }))}
      />
    </div>
  );
}
