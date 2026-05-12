import { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type { Characteristic, NumExpr, RuleArithOp } from '@/types/database'
import { ARITH_LABELS, literalExpr } from '@/lib/rulesShape'
import { t, pickTranslation } from '@/i18n'

/**
 * Click-to-edit arithmetic-expression editor. Borrows the visual idiom from
 * FormulaBuilder.tsx but stays purely numeric — literals, numeric-char inputs,
 * and binary arithmetic. Used inside rule conditions and numeric effects.
 *
 * Depth is not hard-capped in the data model but the recursion makes deeper
 * trees uncomfortable to look at — keep it to ~3 levels in practice.
 */
interface Props {
  value:    NumExpr
  onChange: (next: NumExpr) => void
  chars:    Characteristic[]
  lang:     string
  /** When false, hides the "wrap in operation" button (e.g. at deep levels). */
  allowNest?: boolean
}

const ARITH_OPS: RuleArithOp[] = ['add', 'subtract', 'multiply', 'divide']

export function NumExprInput({ value, onChange, chars, lang, allowNest = true }: Props) {
  const numericChars = chars.filter(c => c.display_type === 'number')

  if (value.type === 'number') {
    return (
      <NodeShell>
        <input
          type="number"
          value={String(value.value)}
          onChange={e => onChange({ type: 'number', value: parseFloat(e.target.value) || 0 })}
          className="w-20 rounded border border-input bg-background px-2 py-0.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <KindPicker
          current="number"
          onPick={kind => onChange(switchKind(value, kind, numericChars))}
          numericChars={numericChars}
          lang={lang}
          allowNest={allowNest}
        />
      </NodeShell>
    )
  }

  if (value.type === 'input') {
    return (
      <NodeShell>
        <CharSelect
          value={value.char_id}
          chars={numericChars}
          lang={lang}
          onChange={id => onChange({ type: 'input', char_id: id })}
        />
        <KindPicker
          current="input"
          onPick={kind => onChange(switchKind(value, kind, numericChars))}
          numericChars={numericChars}
          lang={lang}
          allowNest={allowNest}
        />
      </NodeShell>
    )
  }

  // arith
  return (
    <NodeShell vertical>
      <div className="flex items-center gap-1">
        <NumExprInput
          value={value.left}
          onChange={left => onChange({ ...value, left })}
          chars={chars}
          lang={lang}
          allowNest={allowNest}
        />
        <select
          value={value.op}
          onChange={e => onChange({ ...value, op: e.target.value as RuleArithOp })}
          className="rounded border border-input bg-background px-1 py-0.5 text-xs font-mono"
        >
          {ARITH_OPS.map(op => (
            <option key={op} value={op}>{ARITH_LABELS[op]}</option>
          ))}
        </select>
        <NumExprInput
          value={value.right}
          onChange={right => onChange({ ...value, right })}
          chars={chars}
          lang={lang}
          allowNest={allowNest}
        />
        <button
          type="button"
          title={t('Replace with a literal')}
          onClick={() => onChange(literalExpr(0))}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </NodeShell>
  )
}

// ── Sub-pieces ──────────────────────────────────────────────────────────

function NodeShell({ children, vertical }: { children: React.ReactNode; vertical?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 ${vertical ? '' : ''}`}>
      {children}
    </span>
  )
}

function CharSelect({ value, chars, lang, onChange }: {
  value:    string
  chars:    Characteristic[]
  lang:     string
  onChange: (id: string) => void
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="rounded border border-input bg-background px-1 py-0.5 text-xs max-w-[10rem]"
    >
      <option value="">{t('(pick numeric char)')}</option>
      {chars.map(c => (
        <option key={c.id} value={c.id}>
          {pickTranslation(c.name_i18n as Record<string, string> | null, lang, c.name)}
        </option>
      ))}
    </select>
  )
}

type Kind = 'number' | 'input' | 'arith'

function KindPicker({
  current, onPick, numericChars, lang, allowNest,
}: {
  current:      Kind
  onPick:       (kind: Kind) => void
  numericChars: Characteristic[]
  lang:         string
  allowNest:    boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-muted-foreground hover:text-foreground"
        title={t('Change expression type')}
      >
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <span
          className="absolute z-20 top-full right-0 mt-1 rounded-md border bg-popover shadow-lg text-xs w-44 py-1"
          onMouseLeave={() => setOpen(false)}
        >
          <KindOption label={t('Number')} active={current === 'number'} onClick={() => { onPick('number'); setOpen(false) }} />
          <KindOption
            label={t('Characteristic input')}
            active={current === 'input'}
            disabled={numericChars.length === 0}
            disabledHint={t('No numeric characteristics on this product')}
            onClick={() => { onPick('input'); setOpen(false) }}
          />
          {allowNest && (
            <KindOption label={t('Operation (a op b)')} active={current === 'arith'} onClick={() => { onPick('arith'); setOpen(false) }} />
          )}
          {/* swallow lang for ESLint */}
          <span className="hidden">{lang}</span>
        </span>
      )}
    </span>
  )
}

function KindOption({
  label, active, disabled, disabledHint, onClick,
}: {
  label:        string
  active:       boolean
  disabled?:    boolean
  disabledHint?:string
  onClick:      () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? disabledHint : undefined}
      className={[
        'block w-full text-left px-2.5 py-1.5 truncate',
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
        disabled ? 'opacity-40 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function switchKind(prev: NumExpr, kind: Kind, numericChars: Characteristic[]): NumExpr {
  if (kind === 'number') return { type: 'number', value: prev.type === 'number' ? prev.value : 0 }
  if (kind === 'input')  return { type: 'input',  char_id: prev.type === 'input' ? prev.char_id : numericChars[0]?.id ?? '' }
  // arith — wrap the previous expression as the left operand
  return { type: 'arith', op: 'multiply', left: prev, right: { type: 'number', value: 1 } }
}
