# Editable characteristic rules — design

**Date:** 2026-06-04
**Status:** Approved

## Problem

In the product Rules panel ([RulesPanel.tsx](../../../configurator-admin/src/pages/products/components/RulesPanel.tsx)),
configuration rules can be **created** and **deleted**, but not **edited**. To
change a saved rule, a user must delete it and rebuild it from scratch. We want
to make existing rules editable in place.

## Scope

Purely a UI change in `RulesPanel.tsx`.

- The backend already supports it: `updateRule(id, { condition, effects })`
  exists in [rules.ts](../../../configurator-admin/src/lib/rules.ts) and is
  currently unused.
- No migration, no `database.ts` type changes.
- No widget changes — the widget reads the saved `configuration_rules` JSONB
  unchanged.

## Behavior

- Each existing rule row gains an **Edit (pencil)** button beside the existing
  Trash button.
- Clicking Edit switches that row from the read-only `RuleSummary` into an
  inline editor that reuses the **same** `ConditionEditor` + `EffectsEditor`
  components used by the "New rule" form, seeded with the rule's current
  `condition` / `effects`, plus **Save** and **Cancel** buttons.
- **One rule editable at a time.** State is a single edit buffer, so starting an
  edit on another row replaces the current one (a second edit naturally cancels
  the first).
- **Save** runs the same validation as Add (≥1 condition, ≥1 effect, with the
  same toast warnings), calls `updateRule`, patches the row in local `rules`
  state, and collapses back to the summary.
- **Cancel** discards the buffer and collapses with no network call.
- While a row is in edit mode its Edit/Trash buttons are hidden; the other rows'
  buttons stay enabled but starting another edit swaps the buffer.

## Implementation shape

New state in `RulesPanel`:

- `editingId: string | null`
- `editCondition: RuleCondition`
- `editEffects: RuleEffect[]`
- `savingEdit: boolean`

Handlers:

- `startEdit(rule)` — seed `editCondition`/`editEffects` from the rule, set
  `editingId`.
- `cancelEdit()` — clear `editingId` and buffers.
- `handleSaveEdit()` — validate → `updateRule(editingId, { condition, effects })`
  → patch `rules` state → clear.

Rendering: in the `rules.map`, when `rule.id === editingId` render an inline
editor block (ConditionEditor + EffectsEditor + Save/Cancel); otherwise render
the existing summary row with Edit + Trash buttons.

Refactor: the ≥1-condition / ≥1-effect check currently inlined in `handleAdd`
is extracted to a small `validateDraft(condition, effects): boolean` helper
(shows the same toasts) so Add and Save-edit share it.

## Testing

This panel has no existing unit tests, and the change composes
already-tested editor components against an existing lib function. Verify with
`npx tsc --noEmit` and `npm run lint`. No new test file unless requested.
