"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ChartDatum = {
  month: string;
  revenue: number;
  expenses: number;
};

// DESIGN.md "Simple Charts": 2px stroke, 5% opacity gradient fill under the line.
export function MonthlyRevenueChart({ data }: { data: ChartDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0061FF" stopOpacity={0.05} />
            <stop offset="100%" stopColor="#0061FF" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expensesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D92D20" stopOpacity={0.05} />
            <stop offset="100%" stopColor="#D92D20" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#E5E7EB" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fontFamily: "var(--font-inter)", fontSize: 12, fill: "#79767c" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, fill: "#79767c" }}
          tickFormatter={(value: number) => `${value}M`}
        />
        <Tooltip
          contentStyle={{
            background: "#1d1c15",
            border: "none",
            borderRadius: 4,
            fontFamily: "var(--font-inter)",
            fontSize: 12,
          }}
          labelStyle={{ color: "#f5f0e5" }}
          itemStyle={{ fontFamily: "var(--font-jetbrains-mono)" }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Doanh thu"
          stroke="#0061FF"
          strokeWidth={2}
          fill="url(#revenueFill)"
        />
        <Area
          type="monotone"
          dataKey="expenses"
          name="Chi phí"
          stroke="#D92D20"
          strokeWidth={2}
          strokeDasharray="5 5"
          fill="url(#expensesFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
