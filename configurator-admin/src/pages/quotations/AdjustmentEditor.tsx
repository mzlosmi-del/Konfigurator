import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { AdjustmentType, QuotationAdjustment } from '@/types/database'
import { t } from '@/i18n'

export interface AdjustmentDraft {
  type:  AdjustmentType
  label: string
  mode:  'percent' | 'fixed'
  value: string
}

const ADJ_TYPE_LABELS: Record<AdjustmentType, string> = {
  surcharge: 'Surcharge',
  discount:  'Discount',
  tax:       'Tax',
}

interface AdjustmentEditorProps {
  adjustments: AdjustmentDraft[]
  currency:    string
  onChange:    (adjustments: AdjustmentDraft[]) => void
  emptyText?:  string
  compact?:    boolean
}

export function AdjustmentEditor({
  adjustments,
  currency,
  onChange,
  emptyText,
  compact = false,
}: AdjustmentEditorProps) {
  function add() {
    onChange([...adjustments, { type: 'tax', label: '', mode: 'percent', value: '' }])
  }
  function remove(index: number) {
    onChange(adjustments.filter((_, i) => i !== index))
  }
  function patch(index: number, p: Partial<AdjustmentDraft>) {
    onChange(adjustments.map((a, i) => i === index ? { ...a, ...p } : a))
  }

  const inputSize = compact ? 'h-8 text-xs' : ''
  const selectSize = compact ? 'h-8 text-xs' : ''

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-3'}>
      {adjustments.length === 0 && emptyText && (
        <p className={`text-${compact ? 'xs' : 'sm'} text-muted-foreground ${compact ? 'py-1' : 'text-center py-4'}`}>
          {emptyText}
        </p>
      )}
      {adjustments.map((adj, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Select
            value={adj.type}
            onChange={e => patch(idx, { type: e.target.value as AdjustmentType })}
            className={`${compact ? 'w-24' : 'w-32'} ${selectSize}`}
          >
            {(Object.keys(ADJ_TYPE_LABELS) as AdjustmentType[]).map(k => (
              <option key={k} value={k}>{t(ADJ_TYPE_LABELS[k])}</option>
            ))}
          </Select>
          <Input
            value={adj.label}
            onChange={e => patch(idx, { label: e.target.value })}
            placeholder={t('Label (e.g. VAT 20%)')}
            className={`flex-1 ${inputSize}`}
          />
          <Select
            value={adj.mode}
            onChange={e => patch(idx, { mode: e.target.value as 'percent' | 'fixed' })}
            className={`w-20 ${selectSize}`}
          >
            <option value="percent">%</option>
            <option value="fixed">{currency}</option>
          </Select>
          <Input
            type="number" min="0" step="0.01"
            value={adj.value}
            onChange={e => patch(idx, { value: e.target.value })}
            className={`w-24 text-right ${inputSize}`}
            placeholder="0"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => remove(idx)}
            className={`text-muted-foreground hover:text-destructive ${compact ? 'h-8 w-8' : ''}`}
          >
            <Trash2 className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className={compact ? 'h-7 text-xs' : ''}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        {t('Add adjustment')}
      </Button>
    </div>
  )
}

// ── Pure helper: turn drafts into the persisted shape ─────────────────────────
export function buildAdjustmentData(drafts: AdjustmentDraft[]): QuotationAdjustment[] {
  return drafts
    .filter(a => a.label.trim())
    .map(a => ({
      type:  a.type,
      label: a.label.trim(),
      mode:  a.mode,
      value: parseFloat(a.value) || 0,
    }))
}

export function adjustmentToDraft(a: QuotationAdjustment): AdjustmentDraft {
  return { type: a.type, label: a.label, mode: a.mode, value: String(a.value) }
}
