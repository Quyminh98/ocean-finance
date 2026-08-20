---
name: Precision Ledger
colors:
  surface: "#fef9ee"
  surface-dim: "#dedacf"
  surface-bright: "#fef9ee"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f8f3e8"
  surface-container: "#f2ede3"
  surface-container-high: "#ece8dd"
  surface-container-highest: "#e7e2d7"
  on-surface: "#1d1c15"
  on-surface-variant: "#48464b"
  inverse-surface: "#323029"
  inverse-on-surface: "#f5f0e5"
  outline: "#79767c"
  outline-variant: "#cac5cc"
  surface-tint: "#615c6a"
  primary: "#000000"
  on-primary: "#ffffff"
  primary-container: "#1d1a25"
  on-primary-container: "#878190"
  inverse-primary: "#cbc4d3"
  secondary: "#715b34"
  on-secondary: "#ffffff"
  secondary-container: "#fcdfad"
  on-secondary-container: "#77613a"
  tertiary: "#000000"
  on-tertiary: "#ffffff"
  tertiary-container: "#201b0c"
  on-tertiary-container: "#8c836e"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#e7e0f0"
  primary-fixed-dim: "#cbc4d3"
  on-primary-fixed: "#1d1a25"
  on-primary-fixed-variant: "#494552"
  secondary-fixed: "#fcdfad"
  secondary-fixed-dim: "#dfc393"
  on-secondary-fixed: "#271900"
  on-secondary-fixed-variant: "#57441f"
  tertiary-fixed: "#ede1c9"
  tertiary-fixed-dim: "#d0c5ae"
  on-tertiary-fixed: "#201b0c"
  on-tertiary-fixed-variant: "#4d4634"
  background: "#fef9ee"
  on-background: "#1d1c15"
  surface-variant: "#e7e2d7"
  finance-blue: "#0061FF"
  success-green: "#027A48"
  error-red: "#D92D20"
  surface-ice: "#E6F2F5"
  border-subtle: "#E5E7EB"
  warning-orange: "#C2410C"
  violet-tag: "#7C3AED"
  rose-tag: "#BE185D"
  amber-tag: "#CA8A04"
typography:
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: "600"
    lineHeight: "1.2"
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: "600"
    lineHeight: "1.3"
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: "500"
    lineHeight: "1.4"
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "400"
    lineHeight: "1.6"
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "400"
    lineHeight: "1.5"
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: "600"
    lineHeight: "1"
    letterSpacing: 0.05em
  data-tabular:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: "500"
    lineHeight: "1"
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  container-margin: 32px
  gutter: 24px
  card-padding: 20px
  stack-sm: 8px
  stack-md: 16px
---

## Brand & Style

The design system is engineered for high-stakes financial environments where clarity, speed, and precision are paramount. The aesthetic is **High-End Minimalism**—a synthesis of Stripe-inspired utility and professional gravitas. It prioritizes information density without sacrificing legibility, using significant whitespace to separate complex data sets.

The emotional response should be one of absolute control and reliability. By utilizing a "reductionist" approach, we strip away decorative elements, leaving only purposeful strokes, subtle fills, and exceptional typography. This ensures the UI feels "fast" and cognitively light, allowing users to process revenue metrics and financial health at a glance.

## Colors

The palette is anchored by a deep near-black (`#17141F`) for high-contrast typography and a warm off-white (`#FDF8ED`) for the base canvas to reduce eye strain compared to pure white.

- **Primary:** Used for main actions and structural elements.
- **Accent (Finance Blue):** A vibrant, professional blue is used for interactive data points, links, and focus states, evoking the "Stripe" aesthetic.
- **Semantic Colors:** Success and Error colors are strictly reserved for financial trends (e.g., +12% growth) and critical alerts.
- **Tag Accents (Warning Orange / Violet / Rose / Amber):** Added 2026-08-18 as an open-ended preset palette for user-defined tags (Page status labels) — same mid-saturation weight as Finance Blue/Success/Error so a page of tags reads as one system, not off-brand. Reserved for that one picker; do not repurpose for trend/alert semantics (those stay Success/Error only). Amber was added same-day as a bug fix — the "Vàng" preset originally reused `on-secondary-container` (a dark brown, part of the Secondary role's text-on-fill pairing), which doesn't read as yellow at swatch size — then nudged from `#A16207` to a more saturated `#CA8A04` per user feedback ("vàng hơn").
- **Surface Tiers:** Use `#E6F2F5` for subtle background shifts in data tables or sidebar backgrounds to differentiate work areas from the main canvas.
- **Categorical Chart Triplet:** Added 2026-08-18 for the Admin Dashboard "Cơ cấu chi phí" donut (Ads/Lương/Chi phí mua Page breakdown). `Finance Blue` (`#0061FF`) + `Warning Orange` (`#C2410C`) + `Amber` (`#CA8A04`) — the only 3-hue combination of existing tokens that clears the dataviz-skill CVD validator for an all-pairs chart (donut/pie/scatter), where every slice can sit next to every other. Deliberately excludes `Success Green`/`Error Red`: those two already carry a fixed revenue/expense-sign meaning everywhere else in the app (`lib/money.ts`) and would misread as "this slice = good/bad" instead of "this slice = which category" if reused here. A 4th "Khác" bucket (values folded in below the 3 named categories) uses neutral gray, not a 4th hue — reuse this exact triplet (in this hue order) for any future categorical chart with 3 series; add a validated 4th only after re-running the validator, don't eyeball it.

## Typography

This system uses a tiered font strategy to balance personality with utility.

1.  **Headlines (Space Grotesk):** Provides a modern, slightly technical character to dashboard titles and major metrics.
2.  **Body (Inter):** The workhorse for all interface text, chosen for its exceptional legibility in Vietnamese (supporting all diacritics) and neutral tone.
3.  **Data Labels (JetBrains Mono):** Used specifically for numerical values in tables and charts to ensure digits align vertically (tabular lining), making financial comparisons easier for the eye.

**Language Note:** All typography settings are optimized for Vietnamese character heights. Ensure `line-height` is never less than 1.4 for body text to accommodate stackable diacritics.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model. The sidebar remains at a fixed width (260px) while the main content area utilizes a 12-column fluid grid.

- **Rhythm:** An 8px-based grid governs all spatial relationships.
- **Desktop:** 32px outer margins with 24px gutters. Content is housed in modular cards.
- **Mobile:** Margins shrink to 16px. Multi-column tables must reflow into "List Cards" or utilize horizontal scrolling with a locked first column for Row IDs.
- **Information Density:** For finance dashboards, use "Compact" spacing (12px padding) within data tables and "Spacious" spacing (24px) for executive summary cards.

## Elevation & Depth

This design system eschews traditional shadows in favor of **Tonal Layering and Low-Contrast Outlines**.

- **Level 0 (Base):** The canvas color (`#FDF8ED`).
- **Level 1 (Cards/Containers):** Pure white background (`#FFFFFF`) with a 1px solid border (`#E5E7EB`). No shadow.
- **Level 2 (Dropdowns/Modals):** Pure white with a very soft, high-diffusion shadow (0px 10px 30px rgba(0,0,0,0.04)) to indicate float without looking heavy.
- **Active State:** Use a 2px "Finance Blue" border for focused inputs or selected cards rather than increasing elevation.

## Shapes

The shape language is "Soft Professional." We avoid the playfulness of pill shapes in favor of precise, small-radius corners that feel architectural.

- **Buttons & Inputs:** 4px (0.25rem) corner radius.
- **Data Cards:** 8px (0.5rem) corner radius.
- **Icons:** Use 2px stroke weights with squared-off ends to match the `Space Grotesk` headline aesthetic.

## Components

- **Data Cards:** Use a "Metric-first" hierarchy. The large number (Space Grotesk) sits at the top, followed by a JetBrains Mono "trend indicator" (e.g., +2.4%) and a small sparkline chart.
- **Clean Tables:** No vertical borders. Use 1px horizontal dividers only. Header row should be `label-caps` in a subtle gray with a background tint of `#E6F2F5`.
- **Primary Buttons:** Solid `#17141F` background with white text. High contrast, sharp 4px corners.
- **Secondary Buttons:** Ghost style with the `#E5E7EB` border.
- **Sidebar:** Light theme, matching the canvas (`surface` / `#FDF8ED`) with a 1px right-hand border (`#E5E7EB`) separating it from the content area — no dark inversion. Active links use a subtle left-accent border in `Finance Blue` plus a soft `surface-container` background highlight rather than a full-contrast fill; nav text uses `on-surface`/`on-surface-variant`, not white.
- **Simple Charts:** Line charts should use a 2px stroke. Fill the area under the line with a 5% opacity gradient of the stroke color. Use `Finance Blue` for neutral data and `Success/Error` colors for profit/loss specific views.
- **Status Chips:** Small, uppercase labels with low-saturation backgrounds (e.g., a very pale green background with dark green text for "Đã thanh toán").
