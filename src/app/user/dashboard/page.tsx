import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MonthlyRevenueChart } from "@/components/dashboard/monthly-revenue-chart";
import { ExpenseBreakdownChart, type ExpenseBreakdownDatum } from "@/components/dashboard/expense-breakdown-chart";
import { formatMonth, currentMonthKey } from "@/lib/dates";
import { requireUser } from "@/server/auth/rbac";
import { getEmployeeDetailByUserId, getEmployeeFinancials, getEmployeeMonthlySeries } from "@/server/services/employee.service";

export default async function UserDashboardPage() {
  // RBAC: employeeId is always resolved from the session's own userId — never
  // accepted from a client-supplied param (CLAUDE.md "User chỉ xem dữ liệu của chính mình").
  const user = await requireUser();
  const profile = await getEmployeeDetailByUserId(user.id);
  if (!profile) notFound();

  const month = currentMonthKey();
  const [periodFinancials, allTimeFinancials, monthlySeries] = await Promise.all([
    getEmployeeFinancials(profile.employeeId, month),
    getEmployeeFinancials(profile.employeeId),
    getEmployeeMonthlySeries(profile.employeeId),
  ]);

  const chartData = monthlySeries.map((row) => ({
    month: shortMonthLabel(row.month),
    revenue: toMillions(row.revenue),
    expenses: toMillions(row.totalCost),
  }));

  // Cơ cấu chi phí (user request 2026-08-19 "cũng làm biểu đồ tròn giống
  // admin") — cùng component/bảng màu đã dùng ở Admin Dashboard (không có
  // "Tài nguyên" — đó là chi phí chung toàn hệ thống do Admin quản lý, không
  // gắn với một nhân viên cụ thể). Dùng allTimeFinancials (luỹ kế) cho cả 4
  // lát lẫn tâm biểu đồ để tổng luôn khớp đúng bằng tổng 4 lát — same fix as
  // Admin's "1.000.000 ở đâu" mismatch. Lát "Bù chi phí" (thêm sau đó,
  // user request 2026-08-19 "chi phí nhân viên thêm một số tiền đã chốt",
  // nhãn đổi từ "Chốt lợi nhuận" theo yêu cầu user sau đó "số tiền đó tách ra
  // để bù chi phí, số tiền còn lại mới là lợi nhuận") — tái dùng màu #027A48
  // mà Admin Dashboard dùng cho lát thứ 4 "Tài nguyên", để total luôn = tổng
  // slice, tránh lặp lại bug lệch số kể trên.
  const expenseBreakdown: ExpenseBreakdownDatum[] = [
    { key: "ads", label: "Ads", value: allTimeFinancials.adsCost, color: "#0061FF" },
    { key: "salary", label: "Lương", value: allTimeFinancials.salaryCost, color: "#C2410C" },
    { key: "pagePurchase", label: "Mua Page", value: allTimeFinancials.pagePurchaseCost, color: "#CA8A04" },
    { key: "profitSettlement", label: "Bù chi phí", value: allTimeFinancials.profitSettlementCost, color: "#027A48" },
  ];

  return (
    <div>
      <PageHeader title={`Xin chào, ${profile.name}`} description={`Kỳ báo cáo ${formatMonth(month)}`} />

      {/* Ads/Chi phí mua Page/Lương/Tổng chi phí bỏ khỏi đây (user request
          2026-08-19 "bỏ những tab đã được dùng ở biểu đồ đi") — cả 4 con số
          đó đã hiện trong "Cơ cấu chi phí" (3 lát + tổng ở tâm), không cần
          lặp lại thành card riêng nữa. */}
      <div className="mb-gutter grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Page đang quản lý" value={profile.activePages} format="number" />
        <KpiCard label="Doanh thu hiện tại" value={Number(periodFinancials.revenue)} tone="revenue" />
        {/* Doanh thu trừ chi phí — TOÀN THỜI GIAN (allTimeFinancials), không
            theo tháng (user request 2026-08-19, sau khi phát hiện lệch số với
            "Lợi nhuận" bên Admin Employee Detail — trang đó cũng dùng
            getEmployeeFinancials() không truyền tháng). Nếu tính theo tháng
            như "Doanh thu hiện tại" ở trên, salaryCost dùng công thức
            salaryForMonth (chỉ 1 mức lương tại tháng đó) thay vì
            accruedSalaryCost (luỹ kế mọi giai đoạn lương từ trước) mà Admin
            dùng — 2 công thức ra số khác nhau nếu nhân viên từng đổi lương.
            tone="profit" tự đổi màu theo dấu (âm đỏ/dương xanh,
            lib/money.ts profitTextClass), giống hệt "Tổng lợi nhuận" bên
            Admin Dashboard. */}
        <KpiCard
          label="Lợi nhuận"
          value={Number(allTimeFinancials.revenue - allTimeFinancials.totalCost)}
          tone="profit"
        />
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-5">
        <div className="rounded-lg border border-border-subtle bg-surface-container-lowest p-card-padding lg:col-span-3">
          <h2 className="mb-stack-md font-headline-sm text-headline-sm text-on-surface">Doanh thu theo tháng</h2>
          <MonthlyRevenueChart data={chartData} />
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface-container-lowest p-card-padding lg:col-span-2">
          <h2 className="mb-stack-md font-headline-sm text-headline-sm text-on-surface">Cơ cấu chi phí</h2>
          <ExpenseBreakdownChart data={expenseBreakdown} total={allTimeFinancials.totalCost} />
        </div>
      </div>
    </div>
  );
}

function toMillions(amount: bigint): number {
  return Number(amount) / 1_000_000;
}

function shortMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${month}/${year.slice(2)}`;
}
