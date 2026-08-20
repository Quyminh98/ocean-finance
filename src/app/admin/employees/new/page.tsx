import { PageHeader } from "@/components/shared/page-header";
import { CreateEmployeeForm } from "@/components/forms/create-employee-form";

export default function NewEmployeePage() {
  return (
    <div>
      <PageHeader title="Thêm nhân viên" description="Tạo tài khoản và hồ sơ nhân viên mới." />
      <CreateEmployeeForm />
    </div>
  );
}
