import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Default tailwind-merge doesn't know our DESIGN.md custom `--text-*` font-size
// tokens (headline-lg/md/sm, body-lg/md, label-caps, data-tabular) — it falls
// back to bucketing any unrecognized `text-{word}` under the generic text-color
// group, so `cn("text-headline-md text-error-red", "text-headline-lg")` was
// silently dropping the color class (both "text-error-red" and "text-headline-md"
// got treated as the same conflict group as "text-headline-lg" and discarded —
// found via KpiCard's `highlight` + colored `tone` combo losing its color).
// Custom `--color-*` tokens (text-error-red etc.) don't need this — tailwind-merge
// handles those automatically.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["headline-lg", "headline-md", "headline-sm", "body-lg", "body-md", "label-caps", "data-tabular"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
