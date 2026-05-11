import { supabase } from '@/lib/supabase'

/**
 * Per-user, per-table layout persisted in profiles.ui_preferences (JSONB).
 * Migration 070 adds the column. See plan §2.
 */
export interface ColumnPref {
  id:      string
  visible: boolean
}

export interface TableLayout {
  columns: ColumnPref[]   // order matters
  sortBy:  string | null
  sortDir: 'asc' | 'desc'
}

export type UiPreferences = Record<string, TableLayout>

export async function loadUiPreferences(userId: string): Promise<UiPreferences> {
  const { data, error } = await supabase
    .from('profiles')
    .select('ui_preferences')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  const raw = (data as { ui_preferences?: unknown } | null)?.ui_preferences ?? {}
  return typeof raw === 'object' && raw !== null ? raw as UiPreferences : {}
}

/**
 * Read the current preferences, merge in the updated tableKey, and write
 * the whole JSON back. Acceptable here because writes are debounced and
 * each user only writes to their own row.
 */
export async function saveTableLayout(
  userId:   string,
  tableKey: string,
  layout:   TableLayout,
): Promise<void> {
  const current = await loadUiPreferences(userId)
  const next: UiPreferences = { ...current, [tableKey]: layout }
  const { error } = await (supabase.from('profiles') as unknown as {
    update: (v: { ui_preferences: UiPreferences }) => { eq: (col: string, val: string) => Promise<{ error: unknown }> }
  })
    .update({ ui_preferences: next })
    .eq('id', userId)
  if (error) throw error
}

export async function clearTableLayout(userId: string, tableKey: string): Promise<void> {
  const current = await loadUiPreferences(userId)
  if (!(tableKey in current)) return
  const next: UiPreferences = { ...current }
  delete next[tableKey]
  const { error } = await (supabase.from('profiles') as unknown as {
    update: (v: { ui_preferences: UiPreferences }) => { eq: (col: string, val: string) => Promise<{ error: unknown }> }
  })
    .update({ ui_preferences: next })
    .eq('id', userId)
  if (error) throw error
}

/**
 * Merge a saved layout onto the page-declared defaults. Any new column ids
 * that aren't yet in the saved layout are appended (default visible).
 * Saved columns whose id is no longer in defaults are dropped silently.
 */
export function mergeLayout(defaults: TableLayout, saved: TableLayout | undefined): TableLayout {
  if (!saved) return defaults
  const defaultIds = new Set(defaults.columns.map(c => c.id))
  const merged: ColumnPref[] = []
  const seen = new Set<string>()
  for (const c of saved.columns) {
    if (!defaultIds.has(c.id) || seen.has(c.id)) continue
    merged.push(c)
    seen.add(c.id)
  }
  for (const c of defaults.columns) {
    if (!seen.has(c.id)) merged.push(c)
  }
  // Validate sort
  const sortBy = saved.sortBy && merged.some(c => c.id === saved.sortBy) ? saved.sortBy : defaults.sortBy
  return {
    columns: merged,
    sortBy,
    sortDir: saved.sortDir === 'asc' || saved.sortDir === 'desc' ? saved.sortDir : defaults.sortDir,
  }
}
