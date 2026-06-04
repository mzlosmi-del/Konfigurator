import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { DraggableAttributes } from '@dnd-kit/core'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Trash2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { I18nEditor } from '@/components/ui/i18n-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { CharacteristicValuesEditor } from '@/pages/products/components/CharacteristicValuesEditor'
import { AssignAutocomplete } from '@/components/library/AssignAutocomplete'
import type { Characteristic, CharacteristicClass, CharacteristicValue } from '@/types/database'
import { t } from '@/i18n'

// ─── Numeric bounds editor ───────────────────────────────────────────────────
// Shown only for `display_type === 'number'` characteristics. Each bound is
// independently optional (empty input = no bound). Mirrors the DB CHECK from
// migration 088 with an inline guard so the user gets immediate feedback.

function NumericBoundsEditor({
  numericMin,
  numericMax,
  onSave,
}: {
  numericMin: number | null
  numericMax: number | null
  onSave: (min: number | null, max: number | null) => void
}) {
  const [minStr, setMinStr] = useState(numericMin != null ? String(numericMin) : '')
  const [maxStr, setMaxStr] = useState(numericMax != null ? String(numericMax) : '')
  const [error, setError]   = useState<string | null>(null)

  function parseBound(s: string): number | null {
    const trimmed = s.trim()
    if (trimmed === '') return null
    const n = parseFloat(trimmed)
    return Number.isNaN(n) ? null : n
  }

  function commit() {
    const min = parseBound(minStr)
    const max = parseBound(maxStr)
    if (min != null && max != null && min > max) {
      setError(t('Minimum must not be greater than maximum'))
      return
    }
    setError(null)
    // Normalise the inputs to the parsed values (drops invalid characters).
    setMinStr(min != null ? String(min) : '')
    setMaxStr(max != null ? String(max) : '')
    if (min !== numericMin || max !== numericMax) onSave(min, max)
  }

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
        {t('Allowed range')}
      </p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          className="w-32 h-8"
          placeholder={t('Minimum')}
          value={minStr}
          onChange={e => setMinStr(e.target.value)}
          onBlur={commit}
        />
        <span className="text-muted-foreground text-sm">–</span>
        <Input
          type="number"
          className="w-32 h-8"
          placeholder={t('Maximum')}
          value={maxStr}
          onChange={e => setMaxStr(e.target.value)}
          onBlur={commit}
        />
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      <p className="text-[11px] text-muted-foreground mt-1">
        {t('Leave a field empty for no limit.')}
      </p>
    </div>
  )
}

// ─── DraggableChar row ────────────────────────────────────────────────────────

export interface DraggableCharProps {
  char: Characteristic
  classesForChar: CharacteristicClass[]
  allClasses: CharacteristicClass[]
  values: CharacteristicValue[]
  expanded: boolean
  /** When true the row is sortable (reorder within a class). When false it is
   *  draggable onto a class in the rail (assign). Set by the active Library view. */
  sortable: boolean
  /** Highlight rows that belong to no class (shown in the All view). */
  unassigned?: boolean
  onToggleExpand: () => void
  onRename: (name: string) => void
  onUpdateI18n: (i18n: Record<string, string>) => void
  onUpdateDescriptionI18n: (i18n: Record<string, string>) => void
  onChangeType: (type: Characteristic['display_type']) => void
  onUpdateBounds: (min: number | null, max: number | null) => void
  onDelete: () => void
  onAssignToClass: (classId: string) => void
  onRemoveFromClass?: (classId: string) => void
  tenantId: string
  onValuesChange: (updated: CharacteristicValue[]) => void
}

export function DraggableChar(props: DraggableCharProps) {
  if (props.sortable) return <SortableCharRow {...props} />
  return <DraggableCharRow {...props} />
}

// Reorder mode — used inside a single-class view's SortableContext.
function SortableCharRow(props: DraggableCharProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.char.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <CharRowShell
      {...props}
      dragRef={setNodeRef}
      dragAttributes={attributes}
      dragListeners={listeners}
      dragHandleLabel={t('Drag to reorder')}
      isDragging={isDragging}
      style={style}
    />
  )
}

// Assign mode — used in the All / Unassigned views; dragged onto a rail class.
function DraggableCharRow(props: DraggableCharProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.char.id })
  return (
    <CharRowShell
      {...props}
      dragRef={setNodeRef}
      dragAttributes={attributes}
      dragListeners={listeners}
      dragHandleLabel={t('Drag to assign to class')}
      isDragging={isDragging}
    />
  )
}

interface CharRowShellProps extends DraggableCharProps {
  dragRef: (node: HTMLElement | null) => void
  dragAttributes: DraggableAttributes
  dragListeners: SyntheticListenerMap | undefined
  dragHandleLabel: string
  isDragging: boolean
  style?: React.CSSProperties
}

function CharRowShell({
  char,
  classesForChar,
  allClasses,
  values,
  expanded,
  unassigned,
  onToggleExpand,
  onRename,
  onUpdateI18n,
  onUpdateDescriptionI18n,
  onChangeType,
  onUpdateBounds,
  onDelete,
  onAssignToClass,
  onRemoveFromClass,
  tenantId,
  onValuesChange,
  dragRef,
  dragAttributes,
  dragListeners,
  dragHandleLabel,
  isDragging,
  style,
}: CharRowShellProps) {
  const i18n = (char.name_i18n as Record<string, string> | null) ?? {}
  const descriptionI18n = (char.description_i18n as Record<string, string> | null) ?? {}
  const descriptionLangs = Object.entries(descriptionI18n)
    .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
    .map(([k]) => k)

  return (
    <div
      ref={dragRef}
      style={style}
      className={[
        'rounded-lg border bg-card overflow-hidden transition-opacity',
        isDragging ? 'opacity-40' : '',
        unassigned ? 'border-amber-300 bg-amber-50/40' : '',
      ].join(' ')}
    >
      {/* Row */}
      <div className="flex items-center gap-2 px-2 py-2.5">
        {/* Drag handle */}
        <button
          type="button"
          className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
          {...dragAttributes}
          {...dragListeners}
          aria-label={dragHandleLabel}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title={t('Expand to edit name translations and description')}
          aria-label={t('Expand to edit name translations and description')}
        >
          {expanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </button>

        {/* Editable name */}
        <input
          className="flex-1 bg-transparent text-sm font-medium outline-none focus:ring-0 min-w-0"
          defaultValue={char.name}
          onBlur={e => onRename(e.target.value)}
        />

        {/* Description status — surfaces a feature that lives inside the
            expanded section so users can find it without hunting for the
            chevron. Mirrors the class card's translated-langs badge. */}
        {descriptionLangs.length > 0 ? (
          <span
            className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary"
            title={t('Description')}
          >
            {t('Desc')}: {descriptionLangs.map(l => l.toUpperCase()).join('/')}
          </span>
        ) : (
          <button
            type="button"
            onClick={onToggleExpand}
            className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-dashed border-muted-foreground/40 text-muted-foreground hover:text-primary hover:border-primary transition-colors"
          >
            + {t('Add description')}
          </button>
        )}

        <span className="font-mono text-[10px] text-muted-foreground/50 shrink-0 select-all" title={char.id}>
          #{char.id.slice(0, 8)}
        </span>

        {/* Type selector */}
        <Select
          value={char.display_type}
          onChange={e => onChangeType(e.target.value as Characteristic['display_type'])}
          className="text-xs h-7 py-0 w-32 shrink-0"
        >
          <option value="select">{t('Select')}</option>
          <option value="radio">{t('Radio')}</option>
          <option value="swatch">{t('Swatch')}</option>
          <option value="toggle">{t('Toggle')}</option>
          <option value="number">{t('Number')}</option>
          <option value="boolean">{t('Boolean')}</option>
        </Select>

        {/* Class membership tags + type-to-assign input */}
        <div className="flex gap-1 flex-wrap items-center max-w-[280px] shrink-0">
          {classesForChar.map(cls => (
            <span
              key={cls.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground"
            >
              {cls.name}
              {onRemoveFromClass && (
                <button
                  type="button"
                  onClick={() => onRemoveFromClass(cls.id)}
                  className="hover:text-destructive transition-colors"
                  aria-label={`Remove from ${cls.name}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {unassigned && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs border border-dashed border-amber-400 text-amber-700">
              {t('unassigned')}
            </span>
          )}
          <AssignAutocomplete
            className="w-40"
            placeholder={t('Type class name…')}
            options={allClasses
              .filter(c => !classesForChar.some(x => x.id === c.id))
              .map(c => ({ id: c.id, label: c.name }))}
            onSelect={classId => onAssignToClass(classId)}
          />
        </div>

        {/* Value count */}
        <span className="text-xs text-muted-foreground shrink-0 w-14 text-right">
          {values.length} {values.length !== 1 ? t('vals') : t('val')}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t bg-muted/10 space-y-3">
          {/* Name translations */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              {t('Name translations')}
            </p>
            <I18nEditor
              value={i18n}
              onChange={onUpdateI18n}
              placeholder={char.name}
            />
          </div>

          {/* Description translations (optional, shown on quotation PDFs if toggled on) */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              {t('Description (optional, per language)')}
            </p>
            <I18nEditor
              value={descriptionI18n}
              onChange={onUpdateDescriptionI18n}
              placeholder={t('Shown on the quotation PDF when descriptions are enabled')}
              multiline
            />
          </div>

          {/* Numeric bounds — only for number characteristics */}
          {char.display_type === 'number' && (
            <NumericBoundsEditor
              numericMin={char.numeric_min}
              numericMax={char.numeric_max}
              onSave={onUpdateBounds}
            />
          )}

          {/* Values editor */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {t('Values')}
            </p>
            <CharacteristicValuesEditor
              characteristicId={char.id}
              tenantId={tenantId}
              values={values}
              onChange={onValuesChange}
            />
          </div>
        </div>
      )}
    </div>
  )
}
