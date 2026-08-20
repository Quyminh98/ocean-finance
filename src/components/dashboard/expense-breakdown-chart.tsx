"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatVnd } from "@/lib/money";

export type ExpenseBreakdownDatum = {
  key: string;
  label: string;
  value: bigint;
  color: string;
};

type ExpenseBreakdownChartProps = {
  data: ExpenseBreakdownDatum[];
  total: bigint;
};

/**
 * Donut breakdown of Tổng chi phí (Admin Dashboard, user request 2026-08-18
 * "hiển thị biểu đồ tròn ... hiển thị sao cho nó là tập con của tổng chi
 * phí") — Ads/Lương/Chi phí mua Page (+ "Khác" for Tài nguyên, only when
 * non-zero, so slices always sum to the exact same total shown in the
 * center — the same total already on the "Tổng chi phí" KPI card, making
 * the subset relationship visually and numerically unmistakable).
 *
 * Colors are passed in per-datum by the caller (`page.tsx`), not fixed here.
 * Default set: finance-blue/warning-orange/amber-tag for Ads/Lương/Mua Page —
 * the only 3-hue combination of existing DESIGN.md tokens that clears the
 * dataviz skill's all-pairs CVD validator (`node scripts/validate_palette.js
 * "#0061ff,#c2410c,#ca8a04" --pairs all`; one contrast WARN on amber-tag,
 * relieved by the direct-labeled legend below). "Khác" (Tài nguyên) was
 * originally neutral gray to avoid a 4th un-validated hue, but is now
 * success-green **by explicit user request** (2026-08-18) — re-validated as
 * a 4-hue all-pairs set including green before applying (still passes; see
 * `page.tsx` for the exact command). Note this means green no longer
 * exclusively signals "revenue" on this one chart — `lib/money.ts`'s
 * REVENUE_TEXT_CLASS/EXPENSE_TEXT_CLASS convention is unaffected everywhere
 * else in the app.
 */
export function ExpenseBreakdownChart({ data, total }: ExpenseBreakdownChartProps) {
  const nonZero = data.filter((d) => d.value > 0n);
  const chartData = nonZero.map((d) => ({ ...d, value: Number(d.value) }));

  if (nonZero.length === 0) {
    return (
      <div className="flex h-55 items-center justify-center font-body-md text-body-md text-on-surface-variant">
        Chưa có chi phí kỳ này.
      </div>
    );
  }

  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-gutter @xl:flex-row @xl:items-center">
        <div className="relative shrink-0">
          <ResponsiveContainer width={220} height={220}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="label"
                innerRadius={64}
                outerRadius={100}
                // No paddingAngle, no stroke — both were meant as a separator
                // between slices, but at this scale (Ads is ~0.9° of arc at
                // 0.2% share) ANY separator — degree gap or pixel border —
                // is wider than the slice itself and erases it outright.
                // Slices sit flush; the legend/tooltip carry the exact
                // numbers for shares too thin to read visually.
                stroke="none"
                isAnimationActive={false}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `${Number(value).toLocaleString("vi-VN")} ₫`}
                isAnimationActive={false}
                wrapperStyle={{ opacity: 1 }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  opacity: 1,
                  border: "1px solid #000000",
                  borderRadius: 8,
                  fontFamily: "var(--font-inter)",
                  fontSize: 12,
                }}
                labelStyle={{ color: "#1d1c15" }}
                itemStyle={{ fontFamily: "var(--font-jetbrains-mono)", color: "#1d1c15" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Tổng chi phí</span>
            <span className="font-data-tabular text-data-tabular font-semibold text-on-surface">{formatVnd(total)}</span>
          </div>
        </div>

        <div className="w-full min-w-0 space-y-stack-sm @xl:w-72">
          {nonZero.map((item) => {
            const percent = total > 0n ? Math.round((Number(item.value) / Number(total)) * 1000) / 10 : 0;
            return (
              <div key={item.key} className="flex flex-wrap items-center justify-between gap-x-stack-md gap-y-1">
                <span className="flex items-center gap-1.5 font-body-md text-body-md text-on-surface-variant">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
                <span className="font-data-tabular text-data-tabular text-on-surface">
                  {formatVnd(item.value)} <span className="text-on-surface-variant">({percent}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
