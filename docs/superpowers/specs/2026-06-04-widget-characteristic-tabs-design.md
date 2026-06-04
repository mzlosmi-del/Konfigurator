# Widget Characteristic Tabs — Design

**Date:** 2026-06-04
**Status:** Approved design, pre-implementation

## Context

The customer-facing configurator widget (`configurator-widget/`) currently renders
every configurable characteristic of a product as one flat vertical list. Products
with many characteristics produce a long, undifferentiated form. The admin already
organizes characteristics into **characteristic classes** (e.g. "Materials",
"Dimensions", "Hardware") — assigned to products via `product_classes` — but the
widget *flattens* those classes into a single list, discarding the grouping.

This feature surfaces that existing grouping in the widget as **tabs**: each
assigned class becomes a tab. It's a presentation change only — no new data model,
no new admin UI. The goal is a cleaner, scannable configurator for multi-class
products, with zero behavior change for single-class products.

## Requirements (confirmed with user)

- **Tabs = characteristic classes.** Each class assigned to the product becomes one
  tab. No new grouping concept or table.
- **Per-product opt-in.** A `products.group_into_tabs` boolean (default `false`)
  controls whether tabs are used. When off, the widget renders the flat list exactly
  as before this feature. Added in migration 091; toggled in the product Details form
  alongside `show_price_breakdown`.
- **One class → no tabs.** Even when opted in, if the product has only one class (one
  group), render the flat list. Tabs appear only when opted in AND there are ≥2 groups.
- **Free tab switching.** Click any tab to jump to it. Not a stepper/wizard; no
  forced order, no next/back.
- **Visualization, sticky price bar, and the inquiry form stay always visible.**
  Switching a tab only swaps which characteristic *inputs* are shown. The total
  price and the "Request a quote" gate remain global across all tabs.
- **Multi-class characteristic → first tab only.** A characteristic belonging to
  multiple classes appears once, under the first class (by per-product class order).
  This preserves today's dedup behavior.
- **Per-product order applies within each tab.** Tab order follows
  `product_classes.sort_order`; within a tab, characteristics follow class-member
  order, and the existing `product_characteristic_order` override applies within
  each tab.

## Architecture

The change is deliberately a thin **view layer** over unchanged business logic.

### Data: a parallel `groups` array

`loadProductConfig()` in `api.ts` keeps building the flat `characteristics` array
exactly as today (it remains the single source of truth for pricing, selection,
preview, and the completion gate). Alongside it, the function builds a new `groups`
array carrying the per-class grouping:

```ts
interface CharacteristicGroup {
  id: string                          // class_id
  name: string                        // characteristic_classes.name (EN fallback)
  name_i18n?: Record<string, string>  // characteristic_classes.name_i18n JSONB
  characteristicIds: string[]         // ordered, deduped, this group only
}
```

`groups` is added to `FullProductConfig`. Because the flat array is untouched, every
existing code path keeps working with no edits.

### Class names / i18n source

Class labels come from the `characteristic_classes` table's `name` column with
`name_i18n` JSONB for translations. Migration 078 explicitly **kept**
`characteristic_classes.name_i18n` (unlike products/characteristics/values, whose
i18n moved to `tenant_texts`), and the admin `ClassDetailHeader` reads/writes it
directly. So the widget reads `name_i18n` straight off the table — no `tenant_texts`
involvement, no change to the widget's `TextRow` type. One extra small query against
`characteristic_classes` for the assigned class ids.

### Grouping logic: a pure helper

The grouping rules (class ordering, first-class-wins dedup, within-tab override) are
extracted into a pure, unit-tested helper `buildCharacteristicGroups()` in a new file
`configurator-widget/src/charGroups.ts`, mirroring the existing pure helper
`charOrder.ts`. It reuses `applyCharacteristicOrder()` from `charOrder.ts` for the
within-tab ordering — no duplication. Empty groups (all members deduped into earlier
tabs) are dropped.

**Invariant:** concatenating all groups' ids (in class order, pre-override) equals
today's flat dedup order — guards consistency between the flat array and the groups.

### UI: tab bar + filtered render

`Widget.tsx` gains an `activeTab` index in state (reset to 0 on load, clamped
defensively). When `product.group_into_tabs && groups.length > 1`, it renders a tab bar (`cw-tabs`) of class
names (via `pickTranslation`) and shows only the active group's characteristics —
resolved from the flat `characteristics` array by the group's `characteristicIds`,
preserving order. When `groups.length <= 1`, it renders the flat list as today.

Everything else — `totalPrice`, `priceBreakdown`, `lineItems`, `allSelected`,
`previewSelection` — continues iterating the full `characteristics` array, so:
- the price and chips reflect selections from *all* tabs,
- the "Select all options to continue" gate stays global,
- the 3D/2D preview fills defaults for every characteristic regardless of active tab,
- selections in inactive tabs persist (they live in `selection`/`numericInputs`).

## Components / data flow

```
characteristic_classes (name, name_i18n) ─┐
product_classes (sort_order) ─────────────┤
characteristic_class_members ─────────────┼─> buildCharacteristicGroups()
product_characteristic_order ─────────────┘        │
                                                    ├─> groups: CharacteristicGroup[]
                                                    │     (id-level, per-tab)
loadProductConfig() also builds (unchanged) ────────┴─> characteristics: Characteristic[]
                                                          (flat, all chars)

Widget.tsx:
  groups.length > 1 ? [tab bar] + render(group[activeTab].ids → characteristics)
                    : render(characteristics)        // flat, today
  price / gate / preview  →  always over full `characteristics`
```

## Edge cases

| Case | Behavior |
|---|---|
| Zero characteristics / classes | `groups = []`, no tabs, existing empty state |
| Exactly one class | No tabs; identical to today |
| Char in multiple classes | First class only (by `product_classes.sort_order`) |
| Char in no class | Cannot occur — chars derive from class members |
| Class fully deduped away | Empty group dropped; not shown as a blank tab |
| Chars hidden by rules in a tab | Rules hide *values*, not whole chars; tab still valid |
| `activeTab` out of range after reload | Clamped + reset to 0 |

## Testing

- **New:** `configurator-widget/src/__tests__/charGroups.test.ts` — unit tests for
  `buildCharacteristicGroups`: empty input, single class member order, multi-class
  dedup (first wins), empty-group dropping, class ordering by `product_classes`,
  within-group override (and no cross-group leak), the flat-order invariant, and
  name/name_i18n pass-through.
- Existing suites (`rules`, `set-default-flow`, `visualization`, `charOrder`) must
  stay green. No Widget render-test harness exists today; keep logic in the pure
  helper rather than introducing a preact testing-library dependency.

## Build / verify

1. From `configurator-widget/`: `npm run test` — new + existing suites green.
2. `npm run build` in `configurator-widget/` — rebuilds `dist/widget.js` and copies
   it to `configurator-admin/public/widget.js` (both committed, per CLAUDE.md).
3. Type-check: `groups` is required on `FullProductConfig`; update any fixtures that
   construct that type.
4. Manual smoke: a product with ≥2 classes (tabs appear, switching swaps inputs,
   price/CTA global) and a product with 1 class (no tabs, unchanged).

## Out of scope (YAGNI)

- Per-tab "incomplete" indicator dot — global gate already communicates completeness;
  easy fast-follow if users ask.
- Stepper/wizard navigation — explicitly rejected in favor of free switching.
- New admin UI — classes are already managed in the Library page.
