import { formatVnd, REVENUE_TEXT_CLASS, EXPENSE_TEXT_CLASS, profitTextClass } from "@/lib/money";
import { cn } from "@/lib/utils";

type KpiTone = "revenue" | "expense" | "profit" | "neutral";

type KpiCardProps = {
  label: string;
  value: number | bigint;
  hint?: string;
  highlight?: boolean;
  format?: "vnd" | "number";
  /** Money semantic color (DESIGN.md) — "revenue"/"expense" fixed, "profit" follows the value's sign. Defaults to neutral (no color). */
  tone?: KpiTone;
};

function toneClass(tone: KpiTone, value: number | bigint): string {
  if (tone === "revenue") return REVENUE_TEXT_CLASS;
  if (tone === "expense") return EXPENSE_TEXT_CLASS;
  if (tone === "profit") return profitTextClass(value);
  return "text-on-surface";
}

/** Data Card — "Metric-first" hierarchy per DESIGN.md Components. */
export function KpiCard({ label, value, hint, highlight = false, format = "vnd", tone = "neutral" }: KpiCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-lg border border-border-subtle bg-surface-container-lowest p-card-padding",
        highlight && "md:col-span-2",
      )}
    >
      <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">{label}</span>
      <div
        className={cn(
          "mt-stack-sm font-headline-md text-headline-md font-semibold",
          toneClass(tone, value),
          highlight && "font-headline-lg text-headline-lg",
        )}
      >
        {format === "vnd" ? formatVnd(value) : value}
      </div>
      {hint ? (
        <div className="mt-1 font-data-tabular text-data-tabular text-on-surface-variant">{hint}</div>
      ) : null}
    </div>
  );
}
