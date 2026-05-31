// Read a binding path from a TemplateContext given the current loop scope stack.
//
// Scope roots:
//   quotation.*   → ctx.quotation
//   tenant.*      → ctx.tenant
//   line_item.*   → the nearest line_item element on the scope stack
//   config_item.* → the nearest config_item element on the scope stack
//
// `formatValue` turns a raw resolved value into display text (currency, dates),
// and `interpolate` substitutes `{{path}}` tokens inside template strings.

import type { OutputLang as Lang } from '@/lib/languages'
import { labelsFor } from '@/lib/pdf/shared'
import { bindingField, type BindingType } from './bindings'
import type { TemplateContext, ContextLineItem, ContextConfigItem } from './context'

/** One frame of loop scope: a line_item or a config_item element. */
export type ScopeFrame =
  | { kind: 'line_item';   value: ContextLineItem }
  | { kind: 'config_item'; value: ContextConfigItem }

export type ScopeStack = ScopeFrame[]

/** Resolve a path to its raw value (string | number | null | array). Returns
 *  null when the path is unknown or its scope is not active. */
export function resolveRaw(
  ctx: TemplateContext,
  scope: ScopeStack,
  path: string,
): unknown {
  const dot = path.indexOf('.')
  if (dot < 0) return null
  const root = path.slice(0, dot)
  const rest = path.slice(dot + 1)

  switch (root) {
    case 'quotation':
      return (ctx.quotation as unknown as Record<string, unknown>)[rest] ?? null
    case 'tenant':
      return (ctx.tenant as unknown as Record<string, unknown>)[rest] ?? null
    case 'line_item': {
      const frame = nearest(scope, 'line_item')
      if (!frame) return null
      return (frame.value as unknown as Record<string, unknown>)[rest] ?? null
    }
    case 'config_item': {
      const frame = nearest(scope, 'config_item')
      if (!frame) return null
      return (frame.value as unknown as Record<string, unknown>)[rest] ?? null
    }
    default:
      return null
  }
}

function nearest(scope: ScopeStack, kind: ScopeFrame['kind']): ScopeFrame | undefined {
  for (let i = scope.length - 1; i >= 0; i--) {
    if (scope[i].kind === kind) return scope[i]
  }
  return undefined
}

/** Resolve a collection path to an array of elements, pairing each with the
 *  scope frame it should push. Returns [] for unknown / empty collections. */
export function resolveCollection(
  ctx: TemplateContext,
  scope: ScopeStack,
  path: string,
): ScopeFrame[] {
  if (path === 'quotation.line_items') {
    return ctx.quotation.line_items.map(value => ({ kind: 'line_item' as const, value }))
  }
  if (path === 'line_item.configuration') {
    const frame = nearest(scope, 'line_item')
    if (!frame || frame.kind !== 'line_item') return []
    return frame.value.configuration.map(value => ({ kind: 'config_item' as const, value }))
  }
  return []
}

/** Format a raw value for display, given the catalogue type of its path. */
export function formatValue(
  raw: unknown,
  type: BindingType,
  ctx: TemplateContext,
): string {
  if (raw === null || raw === undefined || raw === '') return ''
  switch (type) {
    case 'currency': {
      const n = Number(raw)
      if (!Number.isFinite(n)) return ''
      return ctx.currency ? `${n.toFixed(2)} ${ctx.currency}` : n.toFixed(2)
    }
    case 'number':
      return String(raw)
    case 'date':
      return formatDate(String(raw), ctx.lang)
    case 'image':
    case 'string':
    default:
      return String(raw)
  }
}

function formatDate(iso: string, lang: Lang): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(labelsFor(lang).dateLocale)
}

/** Resolve a binding path to its display string (raw → formatValue using the
 *  catalogue type). Unknown paths resolve to ''. */
export function resolveDisplay(
  ctx: TemplateContext,
  scope: ScopeStack,
  path: string,
): string {
  const field = bindingField(path)
  const raw   = resolveRaw(ctx, scope, path)
  return formatValue(raw, field?.type ?? 'string', ctx)
}

/** Substitute `{{path}}` tokens in a template string with their display value.
 *  Unknown / out-of-scope tokens become the empty string. Literal text is kept. */
export function interpolate(
  template: string,
  ctx: TemplateContext,
  scope: ScopeStack,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path: string) =>
    resolveDisplay(ctx, scope, path),
  )
}
