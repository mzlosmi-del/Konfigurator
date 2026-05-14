import { supabase } from './supabase'
import type { TenantText, TenantTextInsert, TextLevel } from '@/types/database'

/** All text rows visible to the current tenant. Use sparingly — for renderer
 *  paths prefer the lookup helpers below. */
export async function fetchTexts(): Promise<TenantText[]> {
  const { data, error } = await supabase
    .from('tenant_texts')
    .select('*')
    .order('level',        { ascending: true })
    .order('reference_id', { ascending: true, nullsFirst: true })
    .order('slot',         { ascending: true })
    .order('language',     { ascending: true })
    .order('sort_order',   { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as TenantText[]
}

export interface TextScope {
  level:        TextLevel
  reference_id: string | null
}

/** Fetch all rows for one (level, reference) pair across all slots and
 *  languages — handy when populating an inline editor (e.g. the Library row
 *  needs the description for both EN and SR). */
export async function fetchTextsForReference(scope: TextScope): Promise<TenantText[]> {
  let q = supabase.from('tenant_texts').select('*')
    .eq('level', scope.level)
    .order('slot',       { ascending: true })
    .order('language',   { ascending: true })
    .order('sort_order', { ascending: true })
  q = scope.reference_id === null ? q.is('reference_id', null) : q.eq('reference_id', scope.reference_id)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as TenantText[]
}

export interface UpsertTextArgs {
  tenant_id:    string
  level:        TextLevel
  reference_id: string | null
  slot:         string
  language:     'en' | 'sr'
  sort_order?:  number
  label?:       string | null
  content:      string
}

/** Insert or replace a single text row matching the unique key
 *  (tenant_id, level, reference_id, slot, language, sort_order). */
export async function upsertText(args: UpsertTextArgs): Promise<TenantText> {
  const payload: TenantTextInsert = {
    tenant_id:    args.tenant_id,
    level:        args.level,
    reference_id: args.reference_id,
    slot:         args.slot,
    language:     args.language,
    sort_order:   args.sort_order ?? 0,
    label:        args.label ?? null,
    content:      args.content,
  }
  // Two-step: try update first by the natural key, then insert if nothing matched.
  // We can't use Postgres ON CONFLICT directly because supabase-js .upsert()
  // needs a real unique constraint name and our unique index uses COALESCE.
  let q = supabase.from('tenant_texts').update(payload as unknown as never)
    .eq('tenant_id',  args.tenant_id)
    .eq('level',      args.level)
    .eq('slot',       args.slot)
    .eq('language',   args.language)
    .eq('sort_order', args.sort_order ?? 0)
  q = args.reference_id === null ? q.is('reference_id', null) : q.eq('reference_id', args.reference_id)

  const { data: updated, error: updErr } = await q.select().maybeSingle()
  if (updErr) throw new Error(updErr.message)
  if (updated) return updated as TenantText

  const { data: inserted, error: insErr } = await supabase
    .from('tenant_texts')
    .insert(payload as unknown as never)
    .select()
    .single()
  if (insErr) throw new Error(insErr.message)
  return inserted as TenantText
}

export async function deleteText(id: string): Promise<void> {
  const { error } = await supabase.from('tenant_texts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Apply a new ordering to a set of multi-row slot entries. Pass the IDs in
 *  the desired order; sort_order is renumbered from 0. */
export async function reorderTexts(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id, idx) =>
    supabase.from('tenant_texts')
      .update({ sort_order: idx } as unknown as never)
      .eq('id', id)
  ))
}

// ── Renderer-facing lookup helpers ──────────────────────────────────────────
// These are intentionally simple — pass a pre-fetched rows array (typically
// the result of fetchTextsForReference or fetchTexts) and resolve in memory.
// This keeps PDF / DOCX / XLSX builders synchronous after one initial fetch.

export interface TextLookupRows {
  rows: TenantText[]
}

/** Resolve a single (scope, slot, lang) → content, with a graceful fallback:
 *  if the requested language is missing, try the other one. Returns the empty
 *  string when nothing matches. Use this for single-row slots like `name`,
 *  `description`, `pdf_footer`. */
export function resolveText(
  rows: TenantText[],
  level: TextLevel,
  reference_id: string | null,
  slot: string,
  language: 'en' | 'sr',
): string {
  const candidates = rows.filter(r =>
    r.level === level && r.reference_id === reference_id && r.slot === slot
  )
  if (candidates.length === 0) return ''
  const exact = candidates.find(r => r.language === language)
  if (exact && exact.content.trim()) return exact.content
  const other = candidates.find(r => r.language !== language)
  return other?.content ?? ''
}

/** Resolve a (scope, slot) → `{ en, sr }` translation map, suitable for the
 *  I18nEditor component and JSONB-shaped renderer arguments. */
export function resolveTextI18n(
  rows: TenantText[],
  level: TextLevel,
  reference_id: string | null,
  slot: string,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    if (r.level === level && r.reference_id === reference_id && r.slot === slot && r.content.trim()) {
      out[r.language] = r.content
    }
  }
  return out
}

/** Resolve all rows for a multi-row slot ordered by sort_order. Returns an
 *  array of contents (already filtered to the requested language). Use for
 *  `terms_line`, `note`, `specification`, etc. */
export function resolveTextLines(
  rows: TenantText[],
  level: TextLevel,
  reference_id: string | null,
  slot: string,
  language: 'en' | 'sr',
): string[] {
  return rows
    .filter(r => r.level === level && r.reference_id === reference_id && r.slot === slot && r.language === language)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(r => r.content)
    .filter(s => s.trim().length > 0)
}

// ── Quotation renderer helpers ──────────────────────────────────────────────

/** A simplified representation of a per-product or tenant-level text block,
 *  mirroring the shape the PDF / DOCX / XLSX templates used when they read
 *  `ProductText` rows. */
export interface ResolvedTextBlock {
  id:         string
  slot:       string
  label:      string | null
  content:    string
  sort_order: number
}

const BLOCK_SLOTS = ['product', 'specification', 'note', 'terms'] as const

/** All visible text blocks attached to a product in the chosen language,
 *  sorted by sort_order. Replaces the legacy
 *  `productTexts[productId].filter(language === lang)` access. */
export function resolveProductTextBlocks(
  rows: TenantText[],
  productId: string,
  language: 'en' | 'sr',
): ResolvedTextBlock[] {
  return rows
    .filter(r =>
      r.level === 'product' &&
      r.reference_id === productId &&
      r.language === language &&
      (BLOCK_SLOTS as readonly string[]).includes(r.slot) &&
      r.content.trim().length > 0
    )
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(r => ({ id: r.id, slot: r.slot, label: r.label, content: r.content, sort_order: r.sort_order }))
}

/** All tenant-wide ("global") text blocks in the chosen language. Replaces
 *  the legacy `globalTexts` array. */
export function resolveTenantTextBlocks(
  rows: TenantText[],
  language: 'en' | 'sr',
): ResolvedTextBlock[] {
  return rows
    .filter(r =>
      r.level === 'tenant' &&
      r.reference_id === null &&
      r.language === language &&
      (BLOCK_SLOTS as readonly string[]).includes(r.slot) &&
      r.content.trim().length > 0
    )
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(r => ({ id: r.id, slot: r.slot, label: r.label, content: r.content, sort_order: r.sort_order }))
}

/** Bulk fetch every text row a quotation builder needs:
 *  - all tenant-level rows for the current tenant
 *  - all product-level rows for the products referenced by the quotation's
 *    line items.
 *  One SELECT against `tenant_texts` with an OR clause — RLS scopes to the
 *  tenant automatically. */
export async function fetchQuotationTexts(productIds: string[]): Promise<TenantText[]> {
  const ids = Array.from(new Set(productIds.filter(Boolean)))
  // Tenant-level rows (reference_id IS NULL) always come along; product rows
  // are filtered server-side when there are product ids in scope.
  let q = supabase
    .from('tenant_texts')
    .select('*')
    .order('slot',       { ascending: true })
    .order('language',   { ascending: true })
    .order('sort_order', { ascending: true })

  if (ids.length > 0) {
    q = q.or(`level.eq.tenant,and(level.eq.product,reference_id.in.(${ids.join(',')}))`)
  } else {
    q = q.eq('level', 'tenant')
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as TenantText[]
}
