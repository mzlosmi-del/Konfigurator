# Visualization assignment table (combination → resource)

**Date:** 2026-06-10
**Status:** Approved design — ready for implementation plan

## Problem

Today a visualization asset links to **at most one** `characteristic_value_id`
(or `NULL` = product default). The widget resolves a 2D image by: exact
single-value match → `is_default` → none. There is no way to assign an image to
a **combination** of characteristic values (e.g. "Color = Red AND Material =
Wood"), nor to condition on numeric characteristics with operators.

This feature adds an ordered **assignment table** per product: each row is a set
of per-characteristic conditions plus the asset it resolves to. Rows are
evaluated by priority (first match wins); an empty cell is a wildcard.

**Scope:** 2D visual resources only — `asset_type IN ('image', 'render')`. 3D
models (`asset_type = '3d_model'`) keep their existing `mesh_rules` path
untouched.

## Decisions (from brainstorming)

- **One global ordered table per product** (not per-asset condition lists).
- **Rows reference uploaded assets** — the existing asset upload/library/storage
  pipeline is unchanged; a row's "Asset" column picks one of the product's
  existing `image`/`render` assets. The same asset may be reused across rows.
- **Select cell:** a single value or empty (empty = any value accepted).
- **Numeric cell:** one operator (`=`, `>`, `<`) + one value, or empty. No
  ranges (a range needs two rows).
- **No match → fall back** to the existing `is_default` asset → none. The
  legacy single-value path is the fallback, so products that never use the table
  keep working unchanged (table wins when it has a match).
- **Priority** is an explicit editable number per row (lower = evaluated first),
  not drag-to-reorder.
- **Tiebreak:** if two matching rows share a priority, lowest `id` (oldest) wins
  — deterministic, no uniqueness validation needed.

## Data model

Migration **`migrations/095_visualization_assignments.sql`** (latest is 094).
RLS mirrors `visualization_assets` exactly: tenant-admin full access via
`auth_tenant_id()`, plus anon SELECT gated on the parent product being
`published`.

### `visualization_assignments` (one row per table row)

```sql
CREATE TABLE public.visualization_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  asset_id    uuid NOT NULL REFERENCES public.visualization_assets(id) ON DELETE CASCADE,
  priority    int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

### `visualization_assignment_conditions` (one row per non-empty cell)

```sql
CREATE TABLE public.visualization_assignment_conditions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id     uuid NOT NULL REFERENCES public.visualization_assignments(id) ON DELETE CASCADE,
  characteristic_id uuid NOT NULL REFERENCES public.characteristics(id) ON DELETE CASCADE,
  operator          text NOT NULL DEFAULT 'eq' CHECK (operator IN ('eq', 'gt', 'lt')),
  value_id          uuid REFERENCES public.characteristic_values(id) ON DELETE CASCADE,
  numeric_value     numeric,
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

- **Empty cell = no condition row** for that characteristic → wildcard, for free.
- A row with **zero** condition rows = all-wildcard catch-all.
- Select cells: `operator = 'eq'`, `value_id` set, `numeric_value` NULL.
- Numeric cells: `operator` in (`eq`/`gt`/`lt`), `numeric_value` set, `value_id` NULL.

Indexes: `(product_id)` and `(tenant_id)` on assignments; `(assignment_id)` on
conditions. Both tables get the standard `updated_at` trigger where applicable.

## Resolution logic (widget)

In `configurator-widget/src/resolveImage.ts`, the 2D path (`image`/`render`)
becomes:

1. **Try the assignment table.** Order rows by `(priority ASC, id ASC)`. A row
   matches if **every** one of its conditions passes:
   - **Select** (`operator='eq'`, `value_id`): the selected value for
     `characteristic_id` equals `value_id`.
   - **Numeric** (`operator` ∈ `eq`/`gt`/`lt`, `numeric_value`): the customer's
     numeric input for `characteristic_id` satisfies the operator vs
     `numeric_value`.
   - A characteristic with **no** condition row on this row → skipped (wildcard).
   - If the customer has **not** chosen/entered a value for a characteristic
     that this row conditions on → that condition **fails** (cannot match an
     unmade choice).
   - First fully-matching row wins → return its asset's `url`.
2. **No row matched** → existing logic: `is_default` asset → none.

Pure function over already-loaded data — no extra network round-trip.

`resolve3DAsset` is **not** changed.

## Data loading (widget)

The widget loads config **directly via the Supabase client** in
`configurator-widget/src/api.ts` (RLS-gated table reads, not an Edge Function).
Add two more queries to the existing `Promise.all` block (around line 119):

- `visualization_assignments` filtered by `product_id`, ordered by
  `priority ASC`.
- `visualization_assignment_conditions` filtered by the loaded `assignment_id`s
  (or by a join/`in` on the product's assignment ids).

Attach `assignments` (each carrying its `conditions[]`) to the returned config
object. Widget `types.ts` gains `VisualizationAssignment` and
`VisualizationAssignmentCondition` interfaces.

## Admin UI

In `configurator-admin/src/pages/products/components/VisualizationPanel.tsx`,
add an **"Assignment table"** section below the existing asset list. The asset
upload/library UI is unchanged — rows reference those uploaded assets.

- **Columns** built dynamically from the product's characteristics:
  - **Select** characteristic → a per-cell value dropdown with an "— any —"
    empty option.
  - **Numeric** characteristic → operator dropdown (`=` / `>` / `<`) + number
    input; empty = any.
- **Priority** column: editable number input; rows render sorted by priority.
- **Asset** column: dropdown of the product's `image`/`render` assets (with a
  thumbnail swatch).
- **+ Add row** appends an all-wildcard row pointing at the first asset; trash
  icon deletes a row.
- Persistence via new helpers in `configurator-admin/src/lib/assets.ts`:
  `fetchAssignments(productId)`, `upsertAssignment(...)`,
  `deleteAssignment(id)`. On save, replace a row's conditions with
  delete-then-reinsert for simplicity.
- Audit: add a label-map entry in `auditLog`/`auditLabels.ts` so assignment
  changes appear in the audit log like the rest of the panel.

## Types

Per the manual `database.ts` sync convention, add `Row`/`Insert`/`Update`
interfaces for both new tables in
`configurator-admin/src/types/database.ts`.

## Testing

Extend `configurator-widget/src/__tests__/visualization.test.ts` (or a new
sibling spec) with unit tests for the new `resolveImage` path:

- single-condition select match
- multi-condition AND across two characteristics
- wildcard (empty) cells accept any value
- numeric `gt`, `lt`, `eq`
- priority ordering (lower priority wins)
- `id` tiebreak when priorities collide
- unmade choice on a conditioned characteristic → row does not match
- no row matches → falls back to `is_default`, then none

## Out of scope

- Numeric ranges in a single cell (use two rows).
- Multi-value ("any of") select cells.
- Applying the table to 3D mesh rules.
- Auto-migrating existing `characteristic_value_id` assets into rows (legacy
  path remains as fallback).
