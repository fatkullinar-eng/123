---
version: alpha
name: Bar Estimate
description: "Рабочая смета пивного бара: графит, латунь и прозрачная арифметика."
colors:
  background: "#11151c"
  surface: "#191f29"
  elevated: "#222b38"
  primary: "#e5bb78"
  on-primary: "#201b14"
  text: "#edf0f5"
  muted: "#a5b0c2"
  border: "#354154"
  success: "#94d4ba"
  danger: "#ffaaa5"
typography:
  sans:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "14px"
    lineHeight: "1.5"
  display:
    fontFamily: "Bahnschrift, Segoe UI, sans-serif"
  mono:
    fontFamily: "Consolas, ui-monospace, monospace"
rounded:
  DEFAULT: "10px"
  sm: "6px"
  lg: "16px"
spacing:
  section-gap: "24px"
  page-max: "1680px"
components:
  button:
    rounded: "10px"
  card:
    rounded: "16px"
  input:
    rounded: "6px"
---

# Bar Estimate

## Overview

Product register. Managers configure a beer-bar franchise investment estimate on a Windows laptop, offline, in Russian. The standalone HTML surface uses exactly the same tokens and components; a persistent browser-storage notice is the only layout addition. Source: the user brief and the supplied 2026-10-28 workbook. No Japan-market scope. The reference is a bar architect's cost ledger: quiet blue graphite, a restrained brass total, clear section dividers. Signature: a proportional cost ribbon above a numbered ledger, making the composition of investment visible. Avoid alcohol imagery, promotional dashboards, neon and decorative KPI cards.

## Colors

The frontmatter owns tokens (Model A). `scripts/tokens.mjs` generates `src/tokens.css` from it; UI consumes `--color-*`, `--font-*`, `--radius-*`, `--space-*`. No separate theme adapter. Dark only. Primary is brass for selected state and principal action; success and danger include text. Chart colors use the same neutral/muted/primary tokens with distinct opacity and text labels.

## Typography

Segoe UI is native to the requested Windows platform and supports Cyrillic. Restrained Bahnschrift headings reference technical drawings. Consolas is reserved for small ledger indices. Amounts use tabular numerals, locale ru-RU, RUB, up to two decimal places; full exact values remain in the ledger. Body 14px/1.5; headings 28px/1.2; the total 36px. No network fonts.

## Layout

24px page rhythm, 1680px maximum; desktop: 280px configuration, flexible ledger, 300px summary. Below 1250px summary moves above the ledger. Below 900px the configuration becomes natural document flow. Table owns horizontal overflow, with a 620px bounded vertical viewport and sticky header. No fixed-height ancestor clips the form. Page scroll remains natural. Header and status areas reserve geometry.

## Elevation & Depth

Hierarchy is tonal and bordered. Only modal surfaces cast a shadow. No blurred background or gradients. Summary uses a single brass upper rule.

## Shapes

Controls use 6–10px corners, panels 16px. Compact status pills are the only rounded badges. Lucide stroke icons are 18px; icons always accompany labels except named utility actions.

## Components

`src/ui.tsx` owns Button, Field, Select (native OS popup explicitly accepted on Windows), Modal and feedback. Buttons support brand/neutral/danger and solid/outline/ghost; hover raises contrast, active shifts 1px, focus ring is visible. Disabled controls use reduced opacity and noninteractive cursor. Busy state keeps width and exposes aria-busy. Modal uses native dialog showModal for inert background, focus trap and Escape; app styles own its appearance, with explicit focus return.

Input validation is inline and preserves drafts. Search includes clear. Feedback uses one live region and persistent errors. The price import has file selection, parsing, validation, preview, and explicit replacement. Local saves are explicitly labelled local.

Motion: 140ms background/border transitions, 180ms filter response; no total-count animation (money should remain readable). Reduced-motion removes transitions. Global visible scrollbar track/thumb/hover/active tokens inherit on every scroll region; forced-colors uses system colors.

## Do's and Don'ts

- Do show the exact quantity, rate and amount beside each line.
- Do distinguish refundable funds, reserve and opening budget.
- Don't infer tax rates or additional fees not encoded by the workbook.
- Don't replace the ledger with promotional cards.
