// Property editor for the selected block: content / binding / condition / style.
// Binding pickers are filtered to the scopes active at the block's tree
// position, so authors can never reference an invalid path.

import type { Block, BlockStyle, Condition, CompareOp, StyleSize, StyleColor, StyleAlign, TableColumn, KeyValueRow } from '@/lib/docTemplate/types'
import type { BindingScope } from '@/lib/docTemplate/bindings'
import { fieldsForScopes, bindingLabel } from '@/lib/docTemplate/bindings'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Trash2, Plus } from 'lucide-react'
import { getLang, t } from '@/i18n'
import { collectionsForScopes } from './treeOps'

interface Props {
  block:        Block
  scopes:       Set<BindingScope>
  onChange:     (patch: Partial<Block>) => void
  onDelete:     () => void
  readOnly:     boolean
}

const SIZES:  StyleSize[]  = ['sm', 'base', 'lg', 'xl']
const COLORS: StyleColor[] = ['ink', 'muted', 'accent', 'positive', 'negative']
const ALIGNS: StyleAlign[] = ['left', 'center', 'right']
const OPS: CompareOp[] = ['is-empty', 'not-empty', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte']

export function BlockProperties({ block, scopes, onChange, onDelete, readOnly }: Props) {
  const lang = getLang()
  const fields = fieldsForScopes(scopes)
  const disabled = readOnly

  function setStyle(patch: Partial<BlockStyle>) {
    onChange({ style: { ...block.style, ...patch } } as Partial<Block>)
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold capitalize">{block.kind.replace('-', ' ')}</span>
        {!disabled && (
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1" aria-label={t('Delete')}>
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Content */}
      {(block.kind === 'text' || block.kind === 'heading') && (
        <Field label={t('Content (use {{field}} for data)')}>
          <Textarea
            value={block.content}
            disabled={disabled}
            rows={2}
            onChange={e => onChange({ content: e.target.value } as Partial<Block>)}
          />
          <BindingHints fields={fields} lang={lang} />
        </Field>
      )}
      {block.kind === 'heading' && (
        <Field label={t('Level')}>
          <Select value={String(block.level)} disabled={disabled}
            onChange={e => onChange({ level: Number(e.target.value) as 1 | 2 | 3 } as Partial<Block>)}>
            <option value="1">H1</option><option value="2">H2</option><option value="3">H3</option>
          </Select>
        </Field>
      )}

      {block.kind === 'spacer' && (
        <Field label={t('Height (pt)')}>
          <Input type="number" value={block.height} disabled={disabled}
            onChange={e => onChange({ height: Number(e.target.value) || 0 } as Partial<Block>)} />
        </Field>
      )}

      {block.kind === 'image' && (
        <Field label={t('Source')}>
          <Select value={block.source} disabled={disabled}
            onChange={e => onChange({ source: e.target.value as 'tenant_logo' | 'binding' } as Partial<Block>)}>
            <option value="tenant_logo">{t('Company logo')}</option>
            <option value="binding">{t('From a field')}</option>
          </Select>
          {block.source === 'binding' && (
            <Select className="mt-2" value={block.binding ?? ''} disabled={disabled}
              onChange={e => onChange({ binding: e.target.value } as Partial<Block>)}>
              <option value="">{t('Select image field…')}</option>
              {fieldsForScopes(scopes, { type: 'image' }).map(f => (
                <option key={f.path} value={f.path}>{bindingLabel(f.path, lang)}</option>
              ))}
            </Select>
          )}
        </Field>
      )}

      {block.kind === 'repeater' && (
        <Field label={t('Repeat over')}>
          <Select value={block.over} disabled={disabled}
            onChange={e => onChange({ over: e.target.value as Block['kind'] extends 'repeater' ? typeof block.over : never } as Partial<Block>)}>
            {collectionsForScopes(scopes).map(c => (
              <option key={c} value={c}>{c === 'quotation.line_items' ? t('Line items') : t('Configuration of a line item')}</option>
            ))}
          </Select>
        </Field>
      )}

      {block.kind === 'key-value' && (
        <KeyValueEditor rows={block.rows} fields={fields} lang={lang} disabled={disabled}
          onChange={rows => onChange({ rows } as Partial<Block>)} />
      )}

      {block.kind === 'line-items-table' && (
        <TableEditor block={block} scopes={scopes} lang={lang} disabled={disabled} onChange={onChange} />
      )}

      {/* Style (text-ish blocks) */}
      {(block.kind === 'text' || block.kind === 'heading' || block.kind === 'key-value') && (
        <div className="grid grid-cols-3 gap-2">
          <Field label={t('Size')}>
            <Select value={block.style?.size ?? 'base'} disabled={disabled} onChange={e => setStyle({ size: e.target.value as StyleSize })}>
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label={t('Weight')}>
            <Select value={block.style?.weight ?? 'normal'} disabled={disabled} onChange={e => setStyle({ weight: e.target.value as 'normal' | 'bold' })}>
              <option value="normal">{t('Normal')}</option><option value="bold">{t('Bold')}</option>
            </Select>
          </Field>
          <Field label={t('Align')}>
            <Select value={block.style?.align ?? 'left'} disabled={disabled} onChange={e => setStyle({ align: e.target.value as StyleAlign })}>
              {ALIGNS.map(a => <option key={a} value={a}>{a}</option>)}
            </Select>
          </Field>
          <Field label={t('Color')}>
            <Select value={block.style?.color ?? 'ink'} disabled={disabled} onChange={e => setStyle({ color: e.target.value as StyleColor })}>
              {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
      )}

      {/* Visibility condition */}
      <ConditionEditor condition={block.visible} fields={fields} lang={lang} disabled={disabled}
        onChange={visible => onChange({ visible } as Partial<Block>)} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function BindingHints({ fields, lang }: { fields: ReturnType<typeof fieldsForScopes>; lang: ReturnType<typeof getLang> }) {
  return (
    <details className="mt-1">
      <summary className="text-xs text-muted-foreground cursor-pointer">{t('Available fields')}</summary>
      <div className="mt-1 flex flex-wrap gap-1">
        {fields.filter(f => !f.collection).map(f => (
          <code key={f.path} className="text-[10px] bg-muted px-1 py-0.5 rounded" title={bindingLabel(f.path, lang)}>{`{{${f.path}}}`}</code>
        ))}
      </div>
    </details>
  )
}

function KeyValueEditor({ rows, fields, lang, disabled, onChange }: {
  rows: KeyValueRow[]; fields: ReturnType<typeof fieldsForScopes>; lang: ReturnType<typeof getLang>; disabled: boolean; onChange: (rows: KeyValueRow[]) => void
}) {
  const valueFields = fields.filter(f => !f.collection && f.type !== 'image')
  return (
    <Field label={t('Rows')}>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-1">
            <Input value={row.label} disabled={disabled} placeholder={t('Label')} className="flex-1"
              onChange={e => onChange(rows.map((r, j) => j === i ? { ...r, label: e.target.value } : r))} />
            <Select value={row.value} disabled={disabled} className="flex-1"
              onChange={e => onChange(rows.map((r, j) => j === i ? { ...r, value: e.target.value } : r))}>
              {valueFields.map(f => <option key={f.path} value={f.path}>{bindingLabel(f.path, lang)}</option>)}
            </Select>
            {!disabled && (
              <button className="text-muted-foreground hover:text-destructive px-1" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={t('Remove')}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <Button variant="outline" size="sm" onClick={() => onChange([...rows, { label: 'Label', value: valueFields[0]?.path ?? 'quotation.reference_number' }])}>
            <Plus className="h-3.5 w-3.5 mr-1" />{t('Add row')}
          </Button>
        )}
      </div>
    </Field>
  )
}

function TableEditor({ block, scopes, lang, disabled, onChange }: {
  block: Extract<Block, { kind: 'line-items-table' }>; scopes: Set<BindingScope>; lang: ReturnType<typeof getLang>; disabled: boolean; onChange: (patch: Partial<Block>) => void
}) {
  // Table columns always iterate line items, so line_item fields are available.
  const withItem = new Set(scopes); withItem.add('line_item')
  const valueFields = fieldsForScopes(withItem).filter(f => !f.collection && f.type !== 'image' && (f.scope === 'line_item' || f.scope === 'quotation' || f.scope === 'tenant'))
  const setCols = (columns: TableColumn[]) => onChange({ columns } as Partial<Block>)
  return (
    <Field label={t('Columns')}>
      <div className="space-y-1.5">
        {block.columns.map((col, i) => (
          <div key={i} className="flex gap-1">
            <Input value={col.header} disabled={disabled} placeholder={t('Header')} className="flex-1"
              onChange={e => setCols(block.columns.map((c, j) => j === i ? { ...c, header: e.target.value } : c))} />
            <Select value={col.value} disabled={disabled} className="flex-1"
              onChange={e => setCols(block.columns.map((c, j) => j === i ? { ...c, value: e.target.value } : c))}>
              {valueFields.map(f => <option key={f.path} value={f.path}>{bindingLabel(f.path, lang)}</option>)}
            </Select>
            <Select value={col.align ?? 'left'} disabled={disabled} className="w-20"
              onChange={e => setCols(block.columns.map((c, j) => j === i ? { ...c, align: e.target.value as StyleAlign } : c))}>
              {ALIGNS.map(a => <option key={a} value={a}>{a}</option>)}
            </Select>
            {!disabled && (
              <button className="text-muted-foreground hover:text-destructive px-1" onClick={() => setCols(block.columns.filter((_, j) => j !== i))} aria-label={t('Remove')}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <Button variant="outline" size="sm" onClick={() => setCols([...block.columns, { header: 'Column', value: valueFields[0]?.path ?? 'line_item.product_name' }])}>
            <Plus className="h-3.5 w-3.5 mr-1" />{t('Add column')}
          </Button>
        )}
        <label className="flex items-center gap-2 text-xs mt-1">
          <input type="checkbox" checked={block.showSummary !== false} disabled={disabled}
            onChange={e => onChange({ showSummary: e.target.checked } as Partial<Block>)} />
          {t('Show subtotal / total summary')}
        </label>
      </div>
    </Field>
  )
}

function ConditionEditor({ condition, fields, lang, disabled, onChange }: {
  condition: Condition | undefined; fields: ReturnType<typeof fieldsForScopes>; lang: ReturnType<typeof getLang>; disabled: boolean; onChange: (c: Condition | undefined) => void
}) {
  const cmpFields = fields.filter(f => !f.collection && f.type !== 'image')
  // The UI supports a single comparison predicate (the common "hide when empty"
  // case). The data model supports and/or nesting; advanced authors can build
  // those via saved JSON, but the picker keeps the panel simple.
  const cmp = condition?.type === 'cmp' ? condition : undefined
  const enabled = !!cmp

  return (
    <div className="border-t pt-3">
      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <input type="checkbox" checked={enabled} disabled={disabled}
          onChange={e => onChange(e.target.checked
            ? { type: 'cmp', field: cmpFields[0]?.path ?? 'quotation.notes', op: 'not-empty' }
            : undefined)} />
        {t('Only show when…')}
      </label>
      {cmp && (
        <div className="flex flex-wrap gap-1 mt-2">
          <Select value={cmp.field} disabled={disabled} className="flex-1 min-w-32"
            onChange={e => onChange({ ...cmp, field: e.target.value })}>
            {cmpFields.map(f => <option key={f.path} value={f.path}>{bindingLabel(f.path, lang)}</option>)}
          </Select>
          <Select value={cmp.op} disabled={disabled} className="w-28"
            onChange={e => onChange({ ...cmp, op: e.target.value as CompareOp })}>
            {OPS.map(o => <option key={o} value={o}>{o}</option>)}
          </Select>
          {cmp.op !== 'is-empty' && cmp.op !== 'not-empty' && (
            <Input value={String(cmp.value ?? '')} disabled={disabled} placeholder={t('value')} className="w-24"
              onChange={e => onChange({ ...cmp, value: e.target.value })} />
          )}
        </div>
      )}
    </div>
  )
}
