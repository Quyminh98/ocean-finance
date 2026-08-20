"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type SystemChartDatum = {
  month: string;
  pageRevenue: number;
  adminReceived: number;
  totalExpenses: number;
  profit: number;
};

type SeriesKey = keyof Omit<SystemChartDatum, "month">;

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "pageRevenue", label: "Doanh thu Page", color: "#0061FF" },
  { key: "adminReceived", label: "Admin đã nhận", color: "#CA8A04" },
  { key: "totalExpenses", label: "Tổng chi phí", color: "#D92D20" },
  { key: "profit", label: "Lợi nhuận", color: "#027A48" },
];

/**
 * Admin Dashboard Monthly Chart (spec §11.2) — a dedicated component (not
 * `MonthlyRevenueChart`, which Employee Detail/User Dashboard already use
 * with a fixed 2-series revenue/expenses shape). Legend chips double as a
 * toggle for the 4 system-wide series; Page Revenue + Total Expenses are
 * visible by default. DESIGN.md "Simple Charts": 2px stroke, 5% opacity fill.
 */
export function SystemFinancialsChart({ data }: { data: SystemChartDatum[] }) {
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set(["adminReceived", "profit"]));

  function toggle(key: SeriesKey) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-stack-sm flex flex-wrap items-center gap-4">
        {SERIES.map((series) => {
          const isHidden = hidden.has(series.key);
          return (
            <button
              key={series.key}
              type="button"
              onClick={() => toggle(series.key)}
              className={cn(
                "flex items-center gap-1.5 font-label-caps text-xs transition-opacity",
                isHidden ? "text-outline opacity-50" : "text-on-surface-variant",
              )}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: series.color }} />
              {series.label}
            </button>
          );
        })}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            {SERIES.map((series) => (
              <linearGradient key={series.key} id={`fill-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={series.color} stopOpacity={0.05} />
                <stop offset="100%" stopColor={series.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="#E5E7EB" />
          <XAxis
            dataKey="month"
            tickFormatter={(value: string) => formatMonth(value)}
            tickLine={false}
            axisLine={false}
            tick={{ fontFamily: "var(--font-inter)", fontSize: 12, fill: "#79767c" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, fill: "#79767c" }}
            tickFormatter={(value: number) => `${(value / 1_000_000).toLocaleString("vi-VN")}tr`}
          />
          <Tooltip
            labelFormatter={(value) => (typeof value === "string" ? formatMonth(value) : value)}
            formatter={(value) => `${Number(value).toLocaleString("vi-VN")} ₫`}
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
          {SERIES.filter((series) => !hidden.has(series.key)).map((series) => (
            <Area
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={2}
              fill={`url(#fill-${series.key})`}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
