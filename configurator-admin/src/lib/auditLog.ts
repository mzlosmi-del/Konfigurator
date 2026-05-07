import { supabase } from './supabase'
import type { AuditEntityType, AuditLog } from '@/types/database'

export type AuditChangeType = 'create' | 'update' | 'delete'

export type AuditDiff = Record<string, { old: unknown; new: unknown }>

/**
 * Compare two snapshots and return only the fields that changed, keyed by
 * the human-readable label from `labelMap`. Fields not present in `labelMap`
 * are ignored — keeps internal columns (tenant_id, *_at, etc.) out of the log.
 */
export function computeDiff<T extends Record<string, unknown>>(
  before: Partial<T> | null,
  after: Partial<T> | null,
  labelMap: Record<string, string>,
): AuditDiff {
  const diff: AuditDiff = {}
  const keys = Object.keys(labelMap)
  for (const key of keys) {
    const oldVal = before ? (before as Record<string, unknown>)[key] ?? null : null
    const newVal = after  ? (after  as Record<string, unknown>)[key] ?? null : null
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue
    diff[labelMap[key]] = { old: oldVal, new: newVal }
  }
  return diff
}

interface LogOpts {
  entityType:    AuditEntityType
  entityId:      string
  entityName?:   string | null
  changeType:    AuditChangeType
  diff?:         AuditDiff
  /** Override; otherwise derived from supabase auth.user. */
  tenantId?:     string
  changedById?:  string | null
  changedByName?: string | null
}

/**
 * Insert one row into audit_log. Errors are swallowed and logged to the
 * console — audit logging must never break a save operation.
 */
export async function logChange(opts: LogOpts): Promise<void> {
  try {
    let tenantId = opts.tenantId
    let changedBy = opts.changedById
    if (!tenantId || changedBy === undefined) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      changedBy = changedBy ?? user.id
      if (!tenantId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single()
        tenantId = (profile as { tenant_id: string } | null)?.tenant_id
      }
    }
    if (!tenantId) return

    if (opts.changeType === 'update' && opts.diff && Object.keys(opts.diff).length === 0) {
      return // nothing actually changed — don't log a no-op
    }

    const row = {
      tenant_id:       tenantId,
      entity_type:     opts.entityType,
      entity_id:       opts.entityId,
      entity_name:     opts.entityName ?? null,
      change_type:     opts.changeType,
      changed_by:      changedBy ?? null,
      changed_by_name: opts.changedByName ?? null,
      diff:            opts.diff ?? null,
    }
    const { error } = await supabase.from('audit_log').insert(row as never)
    if (error) console.warn('audit_log insert failed:', error.message)
  } catch (err) {
    console.warn('audit_log insert threw:', err)
  }
}

export interface FetchAuditFilter {
  entityType?: AuditEntityType
  entityId?:   string
  changedBy?:  string
  fromDate?:   string  // ISO
  toDate?:     string  // ISO
  limit?:      number
  offset?:     number
}

export async function fetchAuditLog(filter: FetchAuditFilter = {}): Promise<AuditLog[]> {
  let q = supabase.from('audit_log').select('*').order('changed_at', { ascending: false })
  if (filter.entityType) q = q.eq('entity_type', filter.entityType)
  if (filter.entityId)   q = q.eq('entity_id', filter.entityId)
  if (filter.changedBy)  q = q.eq('changed_by', filter.changedBy)
  if (filter.fromDate)   q = q.gte('changed_at', filter.fromDate)
  if (filter.toDate)     q = q.lte('changed_at', filter.toDate)
  const limit = filter.limit ?? 100
  const offset = filter.offset ?? 0
  q = q.range(offset, offset + limit - 1)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as AuditLog[]
}
