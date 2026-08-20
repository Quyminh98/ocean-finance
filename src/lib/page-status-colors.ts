import type { PageStatusColorValue } from "@/server/validators/page-status-option.schema";

/**
 * Preset swatches for Page.statusColor. GRAY/GREEN/BLUE/RED reuse tokens
 * already defined in globals.css/DESIGN.md (own-hue tints via opacity);
 * ORANGE/PURPLE/PINK/AMBER use the dedicated "Tag Accent" tokens added to
 * globals.css/DESIGN.md for this picker — no free-form hex anywhere, per
 * CLAUDE.md "KHÔNG tự đặt màu ngoài DESIGN.md". AMBER originally reused the
 * secondary-container pair (a dark-brown "on" color at swatch size didn't
 * read as yellow — user-reported bug 2026-08-18), switched to its own token
 * to match the tint pattern the other presets already use.
 */
export const PAGE_STATUS_COLOR_OPTIONS: {
  value: PageStatusColorValue;
  label: string;
  dotClass: string;
  chipClass: string;
}[] = [
  { value: "GRAY", label: "Xám", dotClass: "bg-on-surface-variant", chipClass: "bg-surface-container text-on-surface-variant" },
  { value: "GREEN", label: "Xanh lá", dotClass: "bg-success-green", chipClass: "bg-success-green/10 text-success-green" },
  { value: "BLUE", label: "Xanh dương", dotClass: "bg-finance-blue", chipClass: "bg-finance-blue/10 text-finance-blue" },
  { value: "AMBER", label: "Vàng", dotClass: "bg-amber-tag", chipClass: "bg-amber-tag/10 text-amber-tag" },
  { value: "RED", label: "Đỏ", dotClass: "bg-error-red", chipClass: "bg-error-container text-error-red" },
  { value: "ORANGE", label: "Cam", dotClass: "bg-warning-orange", chipClass: "bg-warning-orange/10 text-warning-orange" },
  { value: "PURPLE", label: "Tím", dotClass: "bg-violet-tag", chipClass: "bg-violet-tag/10 text-violet-tag" },
  { value: "PINK", label: "Hồng", dotClass: "bg-rose-tag", chipClass: "bg-rose-tag/10 text-rose-tag" },
];

export function pageStatusChipClass(color: PageStatusColorValue): string {
  return PAGE_STATUS_COLOR_OPTIONS.find((option) => option.value === color)?.chipClass ?? PAGE_STATUS_COLOR_OPTIONS[0].chipClass;
}
