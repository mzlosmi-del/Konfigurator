# Visualization Assignment Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tenant assign 2D image/render visualization assets to *combinations* of characteristic values via an ordered, per-product lookup table with numeric operators and wildcard cells.

**Architecture:** Two new DB tables (`visualization_assignments` + `visualization_assignment_conditions`) hold ordered condition-rows that point at existing assets. The widget loads them via the existing RLS-gated Supabase reads in `api.ts` and a rewritten `resolveImage()` evaluates rows first-match-wins before falling back to the legacy `is_default` path. The admin gets a self-contained `AssignmentTableEditor` subcomponent inside the existing `VisualizationPanel`.

**Tech Stack:** Postgres + RLS (`auth_tenant_id()`), Supabase JS client, Preact widget (Vitest), React admin (TypeScript, Vitest/jsdom).

**Spec:** `docs/superpowers/specs/2026-06-10-visualization-assignment-table-design.md`

---

## File Structure

- **Create** `migrations/095_visualization_assignments.sql` — two tables, indexes, `updated_at` trigger, RLS policies (mirror `visualization_assets`).
- **Modify** `configurator-admin/src/types/database.ts` — add Row/Insert/Update for both tables.
- **Modify** `configurator-widget/src/types.ts` — add `VisualizationAssignmentCondition`, `VisualizationAssignment`; add `assignments` to `FullProductConfig`.
- **Modify** `configurator-widget/src/resolveImage.ts` — new table-first resolution.
- **Modify** `configurator-widget/src/api.ts` — load assignments + conditions; attach to config.
- **Modify** `configurator-widget/src/components/Visualization.tsx` — pass assignments + numericInputs into `resolveImage`.
- **Create** `configurator-widget/src/__tests__/assignmentResolve.test.ts` — resolution unit tests.
- **Modify** `configurator-admin/src/lib/assets.ts` — `fetchAssignments`, `saveAssignment`, `deleteAssignment`.
- **Create** `configurator-admin/src/pages/products/components/AssignmentTableEditor.tsx` — the builder UI.
- **Modify** `configurator-admin/src/pages/products/components/VisualizationPanel.tsx` — mount the editor.

---

## Task 1: Database migration

**Files:**
- Create: `migrations/095_visualization_assignments.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 095_visualization_assignments.sql
-- Ordered per-product lookup table assigning 2D image/render assets to
-- combinations of characteristic values. First matching row (by priority,
-- then id) wins in the widget; an absent condition for a characteristic is a
-- wildcard. See docs/superpowers/specs/2026-06-10-visualization-assignment-table-design.md
-- Scope: image/render assets only. 3D models keep their mesh_rules path.

CREATE TABLE public.visualization_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  asset_id    uuid NOT NULL REFERENCES public.visualization_assets(id) ON DELETE CASCADE,
  priority    int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vassign_product_id ON public.visualization_assignments(product_id);
CREATE INDEX idx_vassign_tenant_id  ON public.visualization_assignments(tenant_id);
CREATE INDEX idx_vassign_asset_id   ON public.visualization_assignments(asset_id);

CREATE TRIGGER visualization_assignments_updated_at
  BEFORE UPDATE ON public.visualization_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

CREATE INDEX idx_vcond_assignment_id ON public.visualization_assignment_conditions(assignment_id);
CREATE INDEX idx_vcond_tenant_id     ON public.visualization_assignment_conditions(tenant_id);

-- RLS — mirror visualization_assets exactly.
ALTER TABLE public.visualization_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visualization_assignment_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visualization_assignments: tenant admin full access"
  ON public.visualization_assignments FOR ALL
  TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "visualization_assignments: anon reads published products"
  ON public.visualization_assignments FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.status = 'published'
    )
  );

CREATE POLICY "visualization_assignment_conditions: tenant admin full access"
  ON public.visualization_assignment_conditions FOR ALL
  TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "visualization_assignment_conditions: anon reads published products"
  ON public.visualization_assignment_conditions FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.visualization_assignments a
      JOIN public.products p ON p.id = a.product_id
      WHERE a.id = assignment_id
        AND p.status = 'published'
    )
  );
```

- [ ] **Step 2: Verify the `set_updated_at` trigger function name**

Run: `grep -rn "FUNCTION public.set_updated_at\|set_updated_at()" migrations/001_initial_schema.sql`
Expected: a match confirming the function is named `set_updated_at`. If the project uses a different name (e.g. `update_updated_at_column` / `handle_updated_at`), edit the `CREATE TRIGGER ... EXECUTE FUNCTION` line in Step 1 to match before applying. (The `visualization_assets_updated_at` trigger in 001 uses the canonical name — copy whatever it references.)

- [ ] **Step 3: Apply the migration**

Apply via the Supabase MCP `apply_migration` tool (name: `095_visualization_assignments`) OR paste into the Supabase SQL editor. There is no automated runner (see CLAUDE.md).
Expected: no errors; `list_tables` now shows both new tables.

- [ ] **Step 4: Commit**

```bash
git add migrations/095_visualization_assignments.sql
git commit -m "feat(db): add visualization assignment + condition tables (migration 095)"
```

---

## Task 2: Admin database types

**Files:**
- Modify: `configurator-admin/src/types/database.ts` (after the `visualization_assets` block, ~line 347)

- [ ] **Step 1: Add the two table type blocks**

Insert immediately after the closing `}` of the `visualization_assets` entry (before `configuration_rules`):

```typescript
      visualization_assignments: {
        Row: {
          id: string
          tenant_id: string
          product_id: string
          asset_id: string
          priority: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['visualization_assignments']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['visualization_assignments']['Insert']>
      }
      visualization_assignment_conditions: {
        Row: {
          id: string
          tenant_id: string
          assignment_id: string
          characteristic_id: string
          operator: 'eq' | 'gt' | 'lt'
          value_id: string | null
          numeric_value: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['visualization_assignment_conditions']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['visualization_assignment_conditions']['Insert']>
      }
```

- [ ] **Step 2: Type-check**

Run: `cd configurator-admin && npx tsc --noEmit`
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add configurator-admin/src/types/database.ts
git commit -m "feat(types): add assignment table Row/Insert/Update types"
```

---

## Task 3: Widget types

**Files:**
- Modify: `configurator-widget/src/types.ts` (add interfaces near `VisualizationAsset` ~line 126; extend `FullProductConfig` ~line 207)

- [ ] **Step 1: Add the assignment interfaces**

Insert after the `VisualizationAsset` interface (after line 126):

```typescript
/** One condition cell of an assignment row. Absent characteristic = wildcard.
 *  Select cells: operator 'eq' + value_id. Numeric cells: operator + numeric_value.
 *  See migration 095. */
export interface VisualizationAssignmentCondition {
  characteristic_id: string
  operator: 'eq' | 'gt' | 'lt'
  value_id: string | null
  numeric_value: number | null
}

/** One ordered row of the per-product assignment table. Lower `priority` is
 *  evaluated first; ties broken by `id`. Resolves to the asset `asset_id`. */
export interface VisualizationAssignment {
  id: string
  asset_id: string
  priority: number
  conditions: VisualizationAssignmentCondition[]
}
```

- [ ] **Step 2: Extend `FullProductConfig`**

In the `FullProductConfig` interface, add a field after `assets: VisualizationAsset[]` (line 207):

```typescript
  /** Ordered assignment table (migration 095). Empty when the product has no
   *  rows — resolution then falls back to the legacy is_default path. */
  assignments: VisualizationAssignment[]
```

- [ ] **Step 3: Type-check**

Run: `cd configurator-widget && npx tsc --noEmit`
Expected: FAIL — `api.ts` return object is now missing `assignments`, and `Visualization.tsx`/tests may complain. That is expected; Tasks 4–6 resolve it. (If you prefer a green checkpoint, proceed to Task 4 before committing.)

- [ ] **Step 4: Commit**

```bash
git add configurator-widget/src/types.ts
git commit -m "feat(widget-types): add VisualizationAssignment types"
```

---

## Task 4: Resolution logic (TDD)

**Files:**
- Test: `configurator-widget/src/__tests__/assignmentResolve.test.ts` (create)
- Modify: `configurator-widget/src/resolveImage.ts`

`resolveImage` keeps its current 2-arg call shape working (legacy tests + 3D path), so the new data is passed as **optional** 3rd/4th params. New signature:

```typescript
resolveImage(
  assets: VisualizationAsset[],
  selection: Selection,
  assignments?: VisualizationAssignment[],
  numericInputs?: NumericInputs,
): string | null
```

- [ ] **Step 1: Write the failing tests**

Create `configurator-widget/src/__tests__/assignmentResolve.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { resolveImage } from '../resolveImage'
import type { VisualizationAsset, VisualizationAssignment, Selection, NumericInputs } from '../types'

function asset(id: string, url: string): VisualizationAsset {
  return { id, url, characteristic_value_id: null, asset_type: 'image', is_default: false, sort_order: 0, mesh_rules: [] }
}
function row(
  id: string,
  asset_id: string,
  priority: number,
  conditions: VisualizationAssignment['conditions'],
): VisualizationAssignment {
  return { id, asset_id, priority, conditions }
}
const sel = (s: Selection): Selection => s
const num = (n: NumericInputs): NumericInputs => n

const assets = [asset('img-wood', 'wood.png'), asset('img-red', 'red.png'), asset('img-wide', 'wide.png'), asset('img-fallback', 'fallback.png')]

describe('resolveImage assignment table', () => {
  it('single select condition matches', () => {
    const rows = [row('r1', 'img-red', 1, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }])]
    expect(resolveImage(assets, sel({ 'c-color': 'v-red' }), rows)).toBe('red.png')
  })

  it('multi-condition AND requires every cell to match', () => {
    const rows = [row('r1', 'img-wood', 1, [
      { characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null },
      { characteristic_id: 'c-mat',   operator: 'eq', value_id: 'v-wood', numeric_value: null },
    ])]
    expect(resolveImage(assets, sel({ 'c-color': 'v-red', 'c-mat': 'v-wood' }), rows)).toBe('wood.png')
    expect(resolveImage(assets, sel({ 'c-color': 'v-red', 'c-mat': 'v-steel' }), rows)).toBeNull()
  })

  it('empty (absent) condition is a wildcard', () => {
    const rows = [row('r1', 'img-red', 1, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }])]
    // c-mat is unconditioned -> any material accepted
    expect(resolveImage(assets, sel({ 'c-color': 'v-red', 'c-mat': 'v-anything' }), rows)).toBe('red.png')
  })

  it('all-wildcard row is a catch-all', () => {
    const rows = [row('r1', 'img-fallback', 1, [])]
    expect(resolveImage(assets, sel({ 'c-color': 'v-anything' }), rows)).toBe('fallback.png')
  })

  it('numeric gt / lt / eq', () => {
    const gt = [row('r1', 'img-wide', 1, [{ characteristic_id: 'c-w', operator: 'gt', value_id: null, numeric_value: 2000 }])]
    expect(resolveImage(assets, sel({}), gt, num({ 'c-w': 2500 }))).toBe('wide.png')
    expect(resolveImage(assets, sel({}), gt, num({ 'c-w': 1500 }))).toBeNull()

    const lt = [row('r1', 'img-wide', 1, [{ characteristic_id: 'c-w', operator: 'lt', value_id: null, numeric_value: 2000 }])]
    expect(resolveImage(assets, sel({}), lt, num({ 'c-w': 1500 }))).toBe('wide.png')

    const eq = [row('r1', 'img-wide', 1, [{ characteristic_id: 'c-w', operator: 'eq', value_id: null, numeric_value: 2000 }])]
    expect(resolveImage(assets, sel({}), eq, num({ 'c-w': 2000 }))).toBe('wide.png')
    expect(resolveImage(assets, sel({}), eq, num({ 'c-w': 2001 }))).toBeNull()
  })

  it('lower priority wins', () => {
    const rows = [
      row('r2', 'img-red',  2, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }]),
      row('r1', 'img-wood', 1, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }]),
    ]
    expect(resolveImage(assets, sel({ 'c-color': 'v-red' }), rows)).toBe('wood.png')
  })

  it('id tiebreak when priority is equal', () => {
    const rows = [
      row('b-row', 'img-red',  1, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }]),
      row('a-row', 'img-wood', 1, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }]),
    ]
    expect(resolveImage(assets, sel({ 'c-color': 'v-red' }), rows)).toBe('wood.png')
  })

  it('unmade choice on a conditioned characteristic does not match', () => {
    const rows = [row('r1', 'img-red', 1, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }])]
    expect(resolveImage(assets, sel({}), rows)).toBeNull()
    // numeric condition with no input also fails
    const numRow = [row('r2', 'img-wide', 1, [{ characteristic_id: 'c-w', operator: 'gt', value_id: null, numeric_value: 10 }])]
    expect(resolveImage(assets, sel({}), numRow, num({}))).toBeNull()
  })

  it('no row matches -> falls back to is_default', () => {
    const fallbackAssets = [...assets, { ...asset('def', 'is-default.png'), is_default: true }]
    const rows = [row('r1', 'img-red', 1, [{ characteristic_id: 'c-color', operator: 'eq', value_id: 'v-red', numeric_value: null }])]
    expect(resolveImage(fallbackAssets, sel({ 'c-color': 'v-blue' }), rows)).toBe('is-default.png')
  })

  it('row asset_id pointing at a missing asset is skipped', () => {
    const rows = [row('r1', 'img-DOES-NOT-EXIST', 1, [])]
    expect(resolveImage(assets, sel({}), rows)).toBeNull()
  })

  it('legacy 2-arg call still works (no assignments)', () => {
    const legacy = [{ ...asset('a', 'oak.png'), characteristic_value_id: 'v-oak' }]
    expect(resolveImage(legacy, sel({ 'c-mat': 'v-oak' }))).toBe('oak.png')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd configurator-widget && npx vitest run src/__tests__/assignmentResolve.test.ts`
Expected: FAIL — `resolveImage` ignores the 3rd/4th args, so assignment cases return null/default.

- [ ] **Step 3: Rewrite `resolveImage` to evaluate the table first**

Replace the body of `resolveImage` in `configurator-widget/src/resolveImage.ts`. Keep `resolve3DAsset` and `stableFirst` exactly as they are. Update the top import to add the new types:

```typescript
import type {
  VisualizationAsset,
  VisualizationAssignment,
  Selection,
  NumericInputs,
} from './types'

/**
 * Resolve the best displayable image URL for the current selection.
 *
 * 1. Assignment table (migration 095): walk rows by (priority ASC, id ASC).
 *    A row matches when EVERY condition passes. A characteristic with no
 *    condition is a wildcard. An unmade choice on a conditioned characteristic
 *    fails the row. First fully-matching row wins -> its asset's url.
 * 2. Legacy fallback: value-specific asset (characteristic_value_id match),
 *    then is_default, then null.
 *
 * Only 'image' and 'render' asset types are considered. Use resolve3DAsset()
 * for '3d_model' assets.
 */
export function resolveImage(
  assets: VisualizationAsset[],
  selection: Selection,
  assignments: VisualizationAssignment[] = [],
  numericInputs: NumericInputs = {},
): string | null {
  const displayable = (a: VisualizationAsset) =>
    a.asset_type === 'image' || a.asset_type === 'render'

  // ── 1. Assignment table ──────────────────────────────────────────────────
  if (assignments.length > 0) {
    const byId = new Map(assets.filter(displayable).map(a => [a.id, a]))
    const ordered = [...assignments].sort((a, b) =>
      a.priority !== b.priority ? a.priority - b.priority : a.id.localeCompare(b.id)
    )
    for (const row of ordered) {
      const target = byId.get(row.asset_id)
      if (!target) continue // points at a deleted / non-displayable asset
      if (row.conditions.every(c => conditionPasses(c, selection, numericInputs))) {
        return target.url
      }
    }
  }

  // ── 2. Legacy fallback ───────────────────────────────────────────────────
  const selectedValueIds = new Set(Object.values(selection))
  const valueMatches = assets.filter(
    a => displayable(a) &&
         a.characteristic_value_id !== null &&
         selectedValueIds.has(a.characteristic_value_id!)
  )
  if (valueMatches.length > 0) return stableFirst(valueMatches)

  const defaults = assets.filter(a => displayable(a) && a.is_default)
  if (defaults.length > 0) return stableFirst(defaults)

  return null
}

function conditionPasses(
  c: VisualizationAssignment['conditions'][number],
  selection: Selection,
  numericInputs: NumericInputs,
): boolean {
  // Select cell: operator 'eq' + value_id.
  if (c.value_id !== null) {
    return selection[c.characteristic_id] === c.value_id
  }
  // Numeric cell: operator + numeric_value.
  if (c.numeric_value !== null) {
    const input = numericInputs[c.characteristic_id]
    if (input === undefined) return false // unmade choice cannot match
    switch (c.operator) {
      case 'eq': return input === c.numeric_value
      case 'gt': return input > c.numeric_value
      case 'lt': return input < c.numeric_value
    }
  }
  // Malformed condition (no value_id, no numeric_value) never matches.
  return false
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd configurator-widget && npx vitest run src/__tests__/assignmentResolve.test.ts src/__tests__/visualization.test.ts`
Expected: PASS — new suite green AND the existing `visualization.test.ts` (legacy 2-arg behaviour) still green.

- [ ] **Step 5: Commit**

```bash
git add configurator-widget/src/resolveImage.ts configurator-widget/src/__tests__/assignmentResolve.test.ts
git commit -m "feat(widget): resolve images via assignment table, legacy path as fallback"
```

---

## Task 5: Widget data loading

**Files:**
- Modify: `configurator-widget/src/api.ts` (the `Promise.all` block ~line 119–148; the assembly + return ~line 289–301)

- [ ] **Step 1: Add the assignments query to the parallel block**

In the `Promise.all([...])` array (after the `visualization_assets` query, ~line 132), add a 7th entry:

```typescript
    sb.from('visualization_assignments')
      .select('id, asset_id, priority, visualization_assignment_conditions (characteristic_id, operator, value_id, numeric_value)')
      .eq('product_id', config.productId)
      .order('priority', { ascending: true }),
```

Update the destructuring to capture it (add `assignmentsResult` as the 7th element):

```typescript
  const [charResult, valuesResult, assetsResult, rulesResult, formulasResult, classesResult, assignmentsResult] = await Promise.all([
```

- [ ] **Step 2: Add its error guard**

After `if (classesResult.error) throw new Error('Failed to load characteristic classes')` (~line 155):

```typescript
  if (assignmentsResult.error) throw new Error('Failed to load visualization assignments')
```

- [ ] **Step 3: Normalise the nested rows and add to the return object**

Just before the final `return {` (~line 289), build the typed array (the embedded resource comes back under the table name):

```typescript
  const assignments: VisualizationAssignment[] = (assignmentsResult.data ?? []).map((a: any) => ({
    id:       a.id as string,
    asset_id: a.asset_id as string,
    priority: a.priority as number,
    conditions: ((a.visualization_assignment_conditions ?? []) as any[]).map(c => ({
      characteristic_id: c.characteristic_id as string,
      operator:          c.operator as 'eq' | 'gt' | 'lt',
      value_id:          (c.value_id ?? null) as string | null,
      numeric_value:     c.numeric_value === null || c.numeric_value === undefined ? null : Number(c.numeric_value),
    })),
  }))
```

Then add `assignments,` to the returned object literal, right after the `assets:` line (~line 293):

```typescript
    assets:    (assetsData    ?? []) as VisualizationAsset[],
    assignments,
```

- [ ] **Step 4: Add the import**

Ensure `VisualizationAssignment` is imported at the top of `api.ts`. Find the existing type import from `./types` and add `VisualizationAssignment` to it.
Run: `grep -n "from './types'" configurator-widget/src/api.ts`
Then add `VisualizationAssignment` to that import list.

- [ ] **Step 5: Type-check**

Run: `cd configurator-widget && npx tsc --noEmit`
Expected: PASS (the `FullProductConfig.assignments` field is now satisfied).

- [ ] **Step 6: Commit**

```bash
git add configurator-widget/src/api.ts
git commit -m "feat(widget): load assignment rows + conditions with product config"
```

---

## Task 6: Wire assignments into the Visualization component

**Files:**
- Modify: `configurator-widget/src/components/Visualization.tsx` (Props ~line 9–20; resolveImage call ~line 743)
- Trace: whoever renders `<Visualization>` (likely `Widget.tsx`) must pass `assignments`.

- [ ] **Step 1: Add `assignments` to `Visualization` Props**

In the `interface Props` block (~line 9), add:

```typescript
  assignments?: VisualizationAssignment[]
```

Add `VisualizationAssignment` to the type import on line 3:

```typescript
import type { VisualizationAsset, VisualizationAssignment, Selection, NumericInputs, MeshRule, MeshTextureRule } from '../types'
```

- [ ] **Step 2: Accept the prop and pass it to `resolveImage`**

Update the component signature (~line 736) to destructure `assignments = []`:

```typescript
export function Visualization({ assets, assignments = [], selection, previewSelection, numericInputs = {}, arEnabled = true, arPlacement = 'floor' }: Props) {
```

Update the `resolveImage` call (~line 743):

```typescript
  const urlImg = resolveImage(assets, selection, assignments, numericInputs)
```

- [ ] **Step 3: Pass `assignments` from the renderer**

Run: `grep -rn "<Visualization" configurator-widget/src`
For each render site, pass the assignments from config. Example (the config object exposes `assignments` from Task 5):

```tsx
<Visualization
  assets={config.assets}
  assignments={config.assignments}
  selection={selection}
  /* ...existing props unchanged... */
/>
```

- [ ] **Step 4: Type-check + full widget test run**

Run: `cd configurator-widget && npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Build the widget (required — committed bundle)**

Run: `cd configurator-widget && npm run build`
Expected: builds `dist/widget.js` AND copies to `../configurator-admin/public/widget.js` (see CLAUDE.md).

- [ ] **Step 6: Commit (include the rebuilt bundle)**

```bash
git add configurator-widget/src/components/Visualization.tsx configurator-widget/src/components/Widget.tsx configurator-admin/public/widget.js
git commit -m "feat(widget): pass assignment table into Visualization"
```

---

## Task 7: Admin data layer

**Files:**
- Modify: `configurator-admin/src/lib/assets.ts` (append new functions + an `AssignmentRow` type)

These mirror the spec: `saveAssignment` writes the row, then replaces its conditions with delete-then-reinsert.

- [ ] **Step 1: Add the editor-facing types and CRUD helpers**

Append to `configurator-admin/src/lib/assets.ts`:

```typescript
// ── Visualization assignment table (migration 095) ──────────────────────────

export interface AssignmentConditionInput {
  characteristic_id: string
  operator: 'eq' | 'gt' | 'lt'
  value_id: string | null
  numeric_value: number | null
}

export interface AssignmentRow {
  id: string
  asset_id: string
  priority: number
  conditions: AssignmentConditionInput[]
}

export async function fetchAssignments(productId: string): Promise<AssignmentRow[]> {
  const { data, error } = await supabase
    .from('visualization_assignments')
    .select('id, asset_id, priority, visualization_assignment_conditions (characteristic_id, operator, value_id, numeric_value)')
    .eq('product_id', productId)
    .order('priority', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as any[]).map(a => ({
    id: a.id,
    asset_id: a.asset_id,
    priority: a.priority,
    conditions: ((a.visualization_assignment_conditions ?? []) as any[]).map(c => ({
      characteristic_id: c.characteristic_id,
      operator: c.operator,
      value_id: c.value_id ?? null,
      numeric_value: c.numeric_value === null || c.numeric_value === undefined ? null : Number(c.numeric_value),
    })),
  }))
}

/** Insert or update one assignment row and replace its conditions wholesale.
 *  Pass `id: null` to create. Returns the row id. */
export async function saveAssignment(
  productId: string,
  row: { id: string | null; asset_id: string; priority: number; conditions: AssignmentConditionInput[] },
): Promise<string> {
  const tenant_id = await getTenantId()

  let assignmentId = row.id
  if (assignmentId) {
    const { error } = await supabase
      .from('visualization_assignments')
      .update({ asset_id: row.asset_id, priority: row.priority } as unknown as never)
      .eq('id', assignmentId)
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await supabase
      .from('visualization_assignments')
      .insert({ tenant_id, product_id: productId, asset_id: row.asset_id, priority: row.priority } as any)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    assignmentId = (data as { id: string }).id
  }

  // Replace conditions: delete existing, reinsert current set.
  const { error: delError } = await supabase
    .from('visualization_assignment_conditions')
    .delete()
    .eq('assignment_id', assignmentId)
  if (delError) throw new Error(delError.message)

  if (row.conditions.length > 0) {
    const { error: insError } = await supabase
      .from('visualization_assignment_conditions')
      .insert(row.conditions.map(c => ({
        tenant_id,
        assignment_id: assignmentId,
        characteristic_id: c.characteristic_id,
        operator: c.operator,
        value_id: c.value_id,
        numeric_value: c.numeric_value,
      })) as any)
    if (insError) throw new Error(insError.message)
  }

  return assignmentId as string
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase
    .from('visualization_assignments')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: Type-check**

Run: `cd configurator-admin && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add configurator-admin/src/lib/assets.ts
git commit -m "feat(admin): assignment table CRUD helpers"
```

---

## Task 8: Admin assignment-table builder UI

**Files:**
- Create: `configurator-admin/src/pages/products/components/AssignmentTableEditor.tsx`
- Reference (do not change behaviour): `CharacteristicWithValues` shape from `@/lib/products` — each has `id`, `name`, `display_type` (`'select' | 'radio' | 'swatch' | 'toggle' | 'number' | 'boolean'`), and `values: { id, label }[]`.

`display_type === 'number'` → numeric column (operator + value). All other types → select column (value dropdown).

- [ ] **Step 1: Create the editor component**

Create `configurator-admin/src/pages/products/components/AssignmentTableEditor.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  fetchAssignments,
  saveAssignment,
  deleteAssignment,
  type AssignmentRow,
  type AssignmentConditionInput,
} from '@/lib/assets'
import type { CharacteristicWithValues } from '@/lib/products'
import type { VisualizationAsset } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'

interface Props {
  productId: string
  chars: CharacteristicWithValues[]
  assets: VisualizationAsset[]
}

// Local draft row — `id: null` means unsaved. Conditions are keyed by
// characteristic id for easy cell editing; empty/absent = wildcard.
interface DraftRow {
  id: string | null
  asset_id: string
  priority: number
  cells: Record<string, AssignmentConditionInput> // characteristic_id -> condition
}

function toDraft(row: AssignmentRow): DraftRow {
  const cells: Record<string, AssignmentConditionInput> = {}
  for (const c of row.conditions) cells[c.characteristic_id] = c
  return { id: row.id, asset_id: row.asset_id, priority: row.priority, cells }
}

function draftConditions(d: DraftRow): AssignmentConditionInput[] {
  return Object.values(d.cells).filter(c =>
    (c.value_id !== null && c.value_id !== '') ||
    (c.numeric_value !== null && !Number.isNaN(c.numeric_value))
  )
}

export function AssignmentTableEditor({ productId, chars, assets }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<DraftRow[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)

  // Only 2D image/render assets can be targeted (3D uses mesh rules).
  const imageAssets = assets.filter(a => a.asset_type === 'image' || a.asset_type === 'render')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAssignments(productId)
      setRows(data.map(toDraft))
    } catch (e) {
      toast({ title: 'Failed to load assignment table', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [productId, toast])

  useEffect(() => { void load() }, [load])

  const addRow = () => {
    const nextPriority = rows.length === 0 ? 1 : Math.max(...rows.map(r => r.priority)) + 1
    setRows(prev => [...prev, {
      id: null,
      asset_id: imageAssets[0]?.id ?? '',
      priority: nextPriority,
      cells: {},
    }])
  }

  const updateRow = (idx: number, patch: Partial<DraftRow>) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))

  const updateCell = (idx: number, charId: string, patch: Partial<AssignmentConditionInput> | null) =>
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const cells = { ...r.cells }
      if (patch === null) { delete cells[charId]; return { ...r, cells } }
      const base: AssignmentConditionInput = cells[charId] ?? { characteristic_id: charId, operator: 'eq', value_id: null, numeric_value: null }
      cells[charId] = { ...base, ...patch }
      return { ...r, cells }
    }))

  const saveRow = async (idx: number) => {
    const d = rows[idx]
    if (!d.asset_id) { toast({ title: 'Pick an asset for the row', variant: 'destructive' }); return }
    setSavingId(d.id ?? `new-${idx}`)
    try {
      const newId = await saveAssignment(productId, {
        id: d.id,
        asset_id: d.asset_id,
        priority: d.priority,
        conditions: draftConditions(d),
      })
      updateRow(idx, { id: newId })
      toast({ title: 'Row saved' })
    } catch (e) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSavingId(null)
    }
  }

  const removeRow = async (idx: number) => {
    const d = rows[idx]
    if (d.id) {
      try { await deleteAssignment(d.id) }
      catch (e) { toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' }); return }
    }
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  if (loading) return <div className="py-6 flex justify-center"><Spinner /></div>

  if (imageAssets.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">Upload at least one image or render asset above to build an assignment table.</p>
  }

  const sorted = [...rows].sort((a, b) => a.priority - b.priority)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted text-left">
              <th className="p-2 border w-20">Priority</th>
              {chars.map(c => (
                <th key={c.id} className="p-2 border">
                  {c.name} <span className="text-muted-foreground font-normal">({c.display_type === 'number' ? 'numeric' : 'select'})</span>
                </th>
              ))}
              <th className="p-2 border">Asset</th>
              <th className="p-2 border w-24"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(d => {
              const idx = rows.indexOf(d)
              return (
                <tr key={d.id ?? `new-${idx}`}>
                  <td className="p-1 border">
                    <Input type="number" value={d.priority}
                      onChange={e => updateRow(idx, { priority: Number(e.target.value) })}
                      className="w-16" />
                  </td>
                  {chars.map(c => {
                    const cell = d.cells[c.id]
                    if (c.display_type === 'number') {
                      return (
                        <td key={c.id} className="p-1 border">
                          <div className="flex gap-1 items-center">
                            <Select
                              value={cell?.operator ?? 'eq'}
                              onChange={e => updateCell(idx, c.id, { operator: e.target.value as 'eq' | 'gt' | 'lt', value_id: null })}>
                              <option value="eq">=</option>
                              <option value="gt">&gt;</option>
                              <option value="lt">&lt;</option>
                            </Select>
                            <Input type="number" placeholder="any"
                              value={cell?.numeric_value ?? ''}
                              onChange={e => {
                                const v = e.target.value
                                updateCell(idx, c.id, v === '' ? null : { numeric_value: Number(v), value_id: null })
                              }}
                              className="w-20" />
                          </div>
                        </td>
                      )
                    }
                    return (
                      <td key={c.id} className="p-1 border">
                        <Select
                          value={cell?.value_id ?? ''}
                          onChange={e => {
                            const v = e.target.value
                            updateCell(idx, c.id, v === '' ? null : { value_id: v, operator: 'eq', numeric_value: null })
                          }}>
                          <option value="">— any —</option>
                          {c.values.map(val => <option key={val.id} value={val.id}>{val.label}</option>)}
                        </Select>
                      </td>
                    )
                  })}
                  <td className="p-1 border">
                    <Select value={d.asset_id} onChange={e => updateRow(idx, { asset_id: e.target.value })}>
                      {imageAssets.map(a => (
                        <option key={a.id} value={a.id}>{a.url.split('/').pop()}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="p-1 border">
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => saveRow(idx)} disabled={savingId !== null}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => removeRow(idx)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" /> Add row</Button>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd configurator-admin && npx tsc --noEmit`
Expected: PASS. If `Select`/`Input`/`Button` prop shapes differ from the assumptions above, adjust to match the actual `@/components/ui` signatures (check one existing usage in `VisualizationPanel.tsx`).

- [ ] **Step 3: Commit**

```bash
git add configurator-admin/src/pages/products/components/AssignmentTableEditor.tsx
git commit -m "feat(admin): assignment table builder UI"
```

---

## Task 9: Mount the editor in VisualizationPanel

**Files:**
- Modify: `configurator-admin/src/pages/products/components/VisualizationPanel.tsx`

- [ ] **Step 1: Import the editor**

Add near the other component imports (~line 24):

```typescript
import { AssignmentTableEditor } from './AssignmentTableEditor'
```

- [ ] **Step 2: Render it below the existing asset list**

Find where the panel renders the asset list / add-form JSX and, after that block (before the panel's closing fragment/div), insert a titled section. The component already holds `assets` and `chars` in state (see lines 94–95):

```tsx
      <div className="mt-8 border-t pt-6">
        <h3 className="text-sm font-semibold mb-1">Assignment table</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Map combinations of characteristic values to an image. Rows are checked
          top-to-bottom by priority; the first matching row wins. An empty cell
          matches any value. If no row matches, the default asset is used.
        </p>
        <AssignmentTableEditor productId={productId} chars={chars} assets={assets} />
      </div>
```

- [ ] **Step 3: Type-check + admin tests**

Run: `cd configurator-admin && npx tsc --noEmit && npm run test`
Expected: PASS (no existing tests broken).

- [ ] **Step 4: Lint**

Run: `cd configurator-admin && npm run lint`
Expected: PASS (fix any new lint errors in the two new/edited files).

- [ ] **Step 5: Commit**

```bash
git add configurator-admin/src/pages/products/components/VisualizationPanel.tsx
git commit -m "feat(admin): mount assignment table editor in visualization panel"
```

---

## Task 10: Audit logging for assignment changes

**Files:**
- Modify: `configurator-admin/src/lib/auditLabels.ts` (add a label map)
- Modify: `configurator-admin/src/pages/products/components/AssignmentTableEditor.tsx` (call `logChange` on save/delete)

- [ ] **Step 1: Inspect the existing audit helper signature**

Run: `grep -n "export function logChange\|export interface\|labelMap\|export const" configurator-admin/src/lib/auditLog.ts configurator-admin/src/lib/auditLabels.ts`
Note the exact `logChange(opts)` shape and how an existing panel (e.g. pricing or characteristics) calls it. Match that pattern exactly in the next step — do not invent fields.

- [ ] **Step 2: Add a label map entry**

In `configurator-admin/src/lib/auditLabels.ts`, add (matching the file's existing export style):

```typescript
export const visualizationAssignmentLabels: Record<string, string> = {
  priority: 'Priority',
  asset_id: 'Asset',
  conditions: 'Conditions',
}
```

- [ ] **Step 3: Log on save and delete**

In `AssignmentTableEditor.tsx`, after a successful `saveAssignment` (in `saveRow`) and after `deleteAssignment` (in `removeRow`), call `logChange` using the same signature the existing panels use (discovered in Step 1). Example shape — adapt field names to the real `logChange` API:

```typescript
// after successful save:
await logChange({
  entity_type: 'visualization_assignment',
  entity_id: newId,
  action: d.id ? 'update' : 'create',
  diff: { asset_id: d.asset_id, priority: d.priority, conditions: draftConditions(d) },
})
// after successful delete:
await logChange({
  entity_type: 'visualization_assignment',
  entity_id: d.id,
  action: 'delete',
  diff: {},
})
```

Add the import:

```typescript
import { logChange } from '@/lib/auditLog'
```

- [ ] **Step 4: Type-check**

Run: `cd configurator-admin && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add configurator-admin/src/lib/auditLabels.ts configurator-admin/src/pages/products/components/AssignmentTableEditor.tsx
git commit -m "feat(admin): audit-log assignment table changes"
```

---

## Task 11: Final verification

- [ ] **Step 1: Widget — full suite + build + harness leak check**

Run: `cd configurator-widget && npx tsc --noEmit && npx vitest run && npm run build`
Then verify the dev harness did not leak into the bundle (CLAUDE.md guard):
Run: `grep -r __testHarness configurator-admin/public/widget.js`
Expected: tests PASS, build OK, grep returns **nothing**.

- [ ] **Step 2: Admin — type-check, tests, lint**

Run: `cd configurator-admin && npx tsc --noEmit && npm run test && npm run lint`
Expected: all PASS.

- [ ] **Step 3: Manual smoke (documented, not automated)**

In a dev environment with a published product that has ≥2 characteristics and ≥2 image assets:
1. Open the product → Visualization → Assignment table. Add a row, set one select cell + one numeric cell, pick an asset, set priority 1, Save.
2. Add a catch-all row (all "— any —"), pick a different asset, priority 2, Save.
3. In the widget for that product, select the values matching row 1 → confirm row 1's image shows. Change to non-matching values → confirm the catch-all image shows. Clear the table → confirm legacy `is_default` behaviour returns.

- [ ] **Step 4: Confirm git state is clean**

Run: `git status`
Expected: clean working tree; all tasks committed.

---

## Notes / guardrails

- **`set_updated_at` name** — Task 1 Step 2 verifies the trigger function name; do not assume.
- **UI component prop shapes** (`Select`, `Input`, `Button`) — Task 8 assumes a native-`onChange`/`children`-`<option>` `Select`. Verify against an existing usage in `VisualizationPanel.tsx` and adjust if the project's `Select` uses a different API.
- **`logChange` signature** — Task 10 Step 1 mandates reading the real signature before use; the example fields are illustrative.
- **Committed bundle** — the widget `dist`/`public/widget.js` is committed; Tasks 6 and 11 rebuild it. Never hand-edit `public/widget.js`.
- **Scope** — no changes to `resolve3DAsset`, mesh rules, or the existing single-value asset assignment UI. The legacy path is the documented fallback.
```
