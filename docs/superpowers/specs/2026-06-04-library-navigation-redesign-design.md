# Library Navigation Redesign — Design

**Date:** 2026-06-04
**Status:** Approved for planning
**Scope:** UI/UX only. No change to the create/edit/delete/assign process, the data model, or RLS.

## Context

The Library page (`configurator-admin/src/pages/library/LibraryPage.tsx`, ~942 lines)
manages characteristic **classes**, **characteristics**, and **characteristic values**.
Today it renders classes as a responsive grid of cards on top, then one long flat
list of characteristics below. There is **no search, no filtering, and no grouping**.

As tenants accumulate many characteristics and many classes, the page becomes hard
to use: you cannot quickly find a characteristic, the class grid is overwhelming, and
it is hard to see which characteristics belong to which class (or which belong to none).

This redesign improves **navigation, findability, and relationship visibility** while
preserving every existing feature: drag-drop assignment, inline editing, i18n editors,
the embedded values editor, numeric bounds, display-type selection, and
delete-with-impact-preview.

## Goals

- Find any characteristic fast (search + filter).
- See class membership at a glance, including the two edge cases:
  - **Unassigned** characteristics (belong to no class).
  - **Multi-class** characteristics (belong to two or more classes).
- Let users set the order of characteristics **within a class** via drag-reorder.

## Non-goals (YAGNI)

- No pagination or virtual scrolling (datasets are moderate; search solves findability).
- No bulk operations.
- No redesign of the values editor / value rows (value-per-characteristic depth is not the pain point).
- No new database tables or columns — `characteristic_class_members.sort_order` already exists.

## Layout — Toolbar + Master/Detail

Replaces the current grid-on-top / flat-list-below structure.

```
┌───────────────────────────────────────────────────────────────┐
│ Library                                                          │
├───────────────────────────────────────────────────────────────┤
│ 🔍 Search…            [Type: all ▾]   [+ Characteristic][+ Class]│  ← sticky toolbar
├───────────┬───────────────────────────────────────────────────┤
│ VIEWS     │  All characteristics · 48      drag onto a class →  │
│ All    48 │  ┌─────────────────────────────────────────────┐   │
│ ⚠ Unas. 7 │  │ ⠿ ▸ Width (mm)        [Dimensions]  number   │   │
│           │  ├─────────────────────────────────────────────┤   │
│ CLASSES   │  │ ⠿ ▸ Wood type   [Materials][Finishes] 8 vals │   │
│ Dimens. 6 │  ├─────────────────────────────────────────────┤   │
│ Materi. 9 │  │ ⠿ ▸ Edge banding   [unassigned]      3 vals  │   │  ← tinted yellow
│ Finishes 4│  └─────────────────────────────────────────────┘   │
│ Hardware 3│                                                     │
└───────────┴───────────────────────────────────────────────────┘
```

### Toolbar (from direction A)
- **Search box** — live filters the right pane by characteristic name (matches the
  resolved/translated display name as shown today). Case-insensitive substring.
- **Display-type filter** — dropdown: all / select / radio / swatch / toggle / number / boolean.
- **`+ Characteristic` / `+ Class`** — the existing create flows, unchanged.

### Left rail (from direction B — classes as navigation)
- Two special views pinned at the top:
  - **All characteristics** — the default view; full flat list (familiar).
  - **⚠ Unassigned** — characteristics with no class membership; live count.
- One row per class, each showing a live **member count**.
- Selecting a view/class sets the right-pane filter. Search applies *within* the
  current view.
- Each class row is a **drop target** (`useDroppable`) — dragging a characteristic
  onto it assigns it (preserves current `handleAssign`).
- **Class actions** (inline rename, `I18nEditor`, delete-with-`ConfirmDialog`) live in
  a **class-detail header** shown at the top of the right pane when a single class is
  selected. This keeps the rail compact while preserving every class action.

### Right pane
- Renders the filtered list of `DraggableChar` rows — edited inline exactly as today
  (expand → name/description i18n, numeric bounds for `number`, embedded
  `CharacteristicValuesEditor`).
- Each row shows **all** of its class chips (multi-class chars show several).
- **Unassigned** rows are visually flagged (tinted background + "unassigned" badge)
  in the All view.

## Edge cases

- **Unassigned characteristics:** dedicated rail view with a live count so they are
  never lost; visually flagged in the All view. Assigned by dragging onto a class.
  Computed client-side: a characteristic whose id appears in no `memberships[*]` array.
- **Multi-class characteristics:** show all class chips in every view, and appear under
  each of their classes when those classes are selected. Removing from one class
  (existing `handleRemoveMember`) leaves the other memberships intact.

## Context-dependent dragging

A characteristic row's drag does different things depending on the active view:

| Active view              | Drag behavior                                                        |
|--------------------------|----------------------------------------------------------------------|
| All / Unassigned         | Drag row → drop on a class in the rail = **assign** (current behavior)|
| A single class           | Rows are **sortable**; drag up/down = **reorder within that class**  |

- Reorder uses `@dnd-kit/sortable` (already a dependency, `^10.0.0`), wrapping the
  rows in a `SortableContext` only when a single class is selected.
- Assign continues to use `@dnd-kit/core` `useDroppable` on the rail rows.
- `sort_order` is **per-membership**, so it only applies within a single-class view.
  The All and Unassigned views keep their current characteristic-level ordering
  (`characteristics.sort_order` then name) and are not row-reorderable.

## Data layer — one small addition

Almost everything is **client-side state** over data already fetched in `load()`
(`characteristics`, `classes`, `memberships`, `values`). Search, filtering, the rail,
counts, and the unassigned/multi-class derivations require **no new fetches**.

Two changes in `configurator-admin/src/lib/products.ts`:

1. **New `reorderClassMembers(classId, updates)`** — batch-update `sort_order` on
   `characteristic_class_members`, mirroring the existing `reorderAssets` pattern in
   `configurator-admin/src/lib/assets.ts:112`:
   ```ts
   export async function reorderClassMembers(
     classId: string,
     updates: { characteristic_id: string; sort_order: number }[],
   ): Promise<void> {
     await Promise.all(
       updates.map(({ characteristic_id, sort_order }) =>
         supabase
           .from('characteristic_class_members')
           .update({ sort_order } as unknown as never)
           .eq('class_id', classId)
           .eq('characteristic_id', characteristic_id)
       )
     )
   }
   ```
2. **`addCharacteristicToClass`** sets `sort_order` to append at the end of the class
   (current count of that class's members) instead of relying on the default, so new
   members land last in a deterministic position.

`fetchAllMemberships` already orders by `sort_order` (`products.ts:210`), so the
reordered order is reflected on reload with no further change.

## Component organization

`LibraryPage.tsx` is already 942 lines with three nested components. As part of this
change, extract — rather than grow the monolith — into `src/pages/library/`:

- `LibraryToolbar.tsx` — search input + type filter + create buttons.
- `ClassRail.tsx` — the special views + class list with counts and drop targets.
- `ClassDetailHeader.tsx` — class rename / i18n / delete shown atop the right pane.
- Keep `DraggableChar` (extract to `DraggableChar.tsx`), `NumericBoundsEditor`, and
  the existing `CharacteristicValuesEditor` / `CharacteristicDeletionDialog` /
  `AssignAutocomplete` / `I18nEditor` as-is.

`LibraryPage` becomes the container holding shared state (`characteristics`, `classes`,
`memberships`, `values`, plus new UI state: `activeView`, `searchTerm`, `typeFilter`)
and the existing handlers.

## Reused existing code

- `reorderAssets` batch pattern — `configurator-admin/src/lib/assets.ts:112`.
- `@dnd-kit/sortable` — already a dependency.
- All current handlers: `handleAssign`, `handleRemoveMember`, `handleCreateChar`,
  `handleDragStart/End`, inline updates, `logChange`/`computeDiff` audit calls.
- `AssignAutocomplete` keyboard assignment — kept as a secondary assign path.
- i18n UI strings via `t()` in `configurator-admin/src/i18n.ts` (add new keys:
  search placeholder, "All characteristics", "Unassigned", "Type: all", etc., for
  en/sr/de).

## Verification

1. `cd configurator-admin && npx tsc --noEmit` — type-check.
2. `npm run lint`.
3. `npm run dev` and manually verify:
   - Search filters the right pane live; type filter narrows by display type.
   - Rail counts are correct; **All** and **⚠ Unassigned** show the right sets.
   - A multi-class characteristic appears under each of its classes and shows all chips.
   - Removing one class membership leaves the others intact.
   - In All view, dragging a row onto a rail class assigns it (count updates).
   - In a single-class view, dragging rows up/down reorders them; reload preserves
     the new order (confirms `reorderClassMembers` persisted).
   - All existing inline edits still work: rename, display-type, numeric bounds,
     i18n editors, values editor, delete-with-impact-preview.
4. `npm run test` — existing vitest suite still passes.
