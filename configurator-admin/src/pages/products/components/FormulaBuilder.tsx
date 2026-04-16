import type { FormulaNode } from '@/types/database'
import type { Characteristic, CharacteristicValue } from '@/types/database'

// ── Node type helpers ─────────────────────────────────────────────────────────

type NodeType = FormulaNode['type']

const NODE_GROUPS: { label: string; types: NodeType[] }[] = [
  { label: 'Values',      types: ['number', 'base_price', 'modifier', 'input'] },
  { label: 'Selection',   types: ['is_selected'] },
  { label: 'Arithmetic',  types: ['add', 'subtract', 'multiply', 'divide'] },
  { label: 'Compare',     types: ['gt', 'gte', 'lt', 'lte', 'eq'] },
  { label: 'Logic',       types: ['and', 'or'] },
  { label: 'Conditional', types: ['if'] },
]

const NODE_LABELS: Record<NodeType, string> = {
  number:      'Number',
  base_price:  'Base price',
  modifier:    'Price modifier of',
  input:       'Numeric input',
  is_selected: 'Is selected',
  add:         'Add (+)',
  subtract:    'Subtract (−)',
  multiply:    'Multiply (×)',
  divide:      'Divide (÷)',
  gt:          'Greater than (>)',
  gte:         'Greater or equal (≥)',
  lt:          'Less than (<)',
  lte:         'Less or equal (≤)',
  eq:          'Equal (=)',
  and:         'AND',
  or:          'OR',
  if:          'IF / THEN / ELSE',
}

const OP_SYMBOL: Partial<Record<NodeType, string>> = {
  add: '+', subtract: '−', multiply: '×', divide: '÷',
  gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=',
  and: 'AND', or: 'OR',
}

function isBinaryNode(node: FormulaNode): node is Extract<FormulaNode, { left: FormulaNode; right: FormulaNode }> {
  return ['add','subtract','multiply','divide','gt','gte','lt','lte','eq','and','or'].includes(node.type)
}

function defaultNode(type: NodeType, firstCharId = '', firstValueId = ''): FormulaNode {
  const zero: FormulaNode = { type: 'number', value: 0 }
  switch (type) {
    case 'number':      return { type: 'number', value: 0 }
    case 'base_price':  return { type: 'base_price' }
    case 'modifier':    return { type: 'modifier', char_id: firstCharId }
    case 'input':       return { type: 'input', char_id: firstCharId }
    case 'is_selected': return { type: 'is_selected', char_id: firstCharId, value_id: firstValueId }
    case 'if':          return { type: 'if', condition: zero, then: zero, else_node: zero }
    default:            return { type, left: zero, right: zero } as FormulaNode
  }
}

// ── Formula → human-readable string ──────────────────────────────────────────

function formulaToString(
  node: FormulaNode,
  chars: Characteristic[],
  valuesMap: Record<string, CharacteristicValue[]>
): string {
  const charName  = (id: string) => chars.find(c => c.id === id)?.name ?? '?'
  const valueName = (cId: string, vId: string) => valuesMap[cId]?.find(v => v.id === vId)?.label ?? '?'
  const s = (n: FormulaNode): string => formulaToString(n, chars, valuesMap)

  switch (node.type) {
    case 'number':      return String(node.value)
    case 'base_price':  return 'base price'
    case 'modifier':    return node.char_id ? `[${charName(node.char_id)} modifier]` : '[modifier ?]'
    case 'input':       return node.char_id ? `[${charName(node.char_id)}]` : '[input ?]'
    case 'is_selected': return node.char_id
      ? `[${charName(node.char_id)} = ${node.value_id ? valueName(node.char_id, node.value_id) : '?'}]`
      : '[is selected ?]'
    case 'add':         return `(${s(node.left)} + ${s(node.right)})`
    case 'subtract':    return `(${s(node.left)} − ${s(node.right)})`
    case 'multiply':    return `(${s(node.left)} × ${s(node.right)})`
    case 'divide':      return `(${s(node.left)} ÷ ${s(node.right)})`
    case 'gt':          return `(${s(node.left)} > ${s(node.right)})`
    case 'gte':         return `(${s(node.left)} ≥ ${s(node.right)})`
    case 'lt':          return `(${s(node.left)} < ${s(node.right)})`
    case 'lte':         return `(${s(node.left)} ≤ ${s(node.right)})`
    case 'eq':          return `(${s(node.left)} = ${s(node.right)})`
    case 'and':         return `(${s(node.left)} AND ${s(node.right)})`
    case 'or':          return `(${s(node.left)} OR ${s(node.right)})`
    case 'if':          return `IF ${s(node.condition)} THEN ${s(node.then)} ELSE ${s(node.else_node)}`
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

interface Template {
  label: string
  description: string
  build: (firstSelectCharId: string, firstValueId: string, firstNumberCharId: string) => FormulaNode
}

const TEMPLATES: Template[] = [
  {
    label: 'Add fixed amount',
    description: 'base price + X',
    build: () => ({ type: 'add', left: { type: 'base_price' }, right: { type: 'number', value: 0 } }),
  },
  {
    label: 'Multiply base',
    description: 'base price × X',
    build: () => ({ type: 'multiply', left: { type: 'base_price' }, right: { type: 'number', value: 1 } }),
  },
  {
    label: 'Add if value selected',
    description: 'IF [char] = value THEN base + X ELSE base',
    build: (charId, valueId) => ({
      type: 'if',
      condition: { type: 'is_selected', char_id: charId, value_id: valueId },
      then: { type: 'add', left: { type: 'base_price' }, right: { type: 'number', value: 0 } },
      else_node: { type: 'base_price' },
    }),
  },
  {
    label: 'Add if input > N',
    description: 'IF [numeric input] > N THEN base + X ELSE base',
    build: (_c, _v, numCharId) => ({
      type: 'if',
      condition: { type: 'gt', left: { type: 'input', char_id: numCharId }, right: { type: 'number', value: 0 } },
      then: { type: 'add', left: { type: 'base_price' }, right: { type: 'number', value: 0 } },
      else_node: { type: 'base_price' },
    }),
  },
  {
    label: 'Add if A or B selected',
    description: 'IF (A = v1 OR B = v2) THEN base + X ELSE base',
    build: (charId, valueId) => ({
      type: 'if',
      condition: {
        type: 'or',
        left:  { type: 'is_selected', char_id: charId, value_id: valueId },
        right: { type: 'is_selected', char_id: charId, value_id: valueId },
      },
      then: { type: 'add', left: { type: 'base_price' }, right: { type: 'number', value: 0 } },
      else_node: { type: 'base_price' },
    }),
  },
  {
    label: 'Add if A and B selected',
    description: 'IF (A = v1 AND B = v2) THEN base + X ELSE base',
    build: (charId, valueId) => ({
      type: 'if',
      condition: {
        type: 'and',
        left:  { type: 'is_selected', char_id: charId, value_id: valueId },
        right: { type: 'is_selected', char_id: charId, value_id: valueId },
      },
      then: { type: 'add', left: { type: 'base_price' }, right: { type: 'number', value: 0 } },
      else_node: { type: 'base_price' },
    }),
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function CharPicker({ value, chars, onChange }: {
  value: string
  chars: Characteristic[]
  onChange: (id: string) => void
}) {
  if (chars.length === 0) {
    return <span className="text-xs text-muted-foreground italic">No characteristics available</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {chars.map(c => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={[
            'px-2 py-0.5 rounded-full text-xs border font-medium transition-colors',
            value === c.id
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-input hover:bg-muted',
          ].join(' ')}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}

function ValuePicker({ charId, value, valuesMap, onChange }: {
  charId: string
  value: string
  valuesMap: Record<string, CharacteristicValue[]>
  onChange: (id: string) => void
}) {
  const vals = valuesMap[charId] ?? []
  if (vals.length === 0) {
    return <span className="text-xs text-muted-foreground italic">No values for this characteristic</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {vals.map(v => (
        <button
          key={v.id}
          type="button"
          onClick={() => onChange(v.id)}
          className={[
            'px-2 py-0.5 rounded-full text-xs border transition-colors',
            value === v.id
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-input hover:bg-muted',
          ].join(' ')}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}

function SmallSelect({ value, onChange, children, className = '' }: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`rounded border border-input bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${className}`}
    >
      {children}
    </select>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface FormulaBuilderProps {
  node: FormulaNode
  onChange: (node: FormulaNode) => void
  characteristics: Characteristic[]
  valuesMap: Record<string, CharacteristicValue[]>
  /** When true, show the preview string and templates (only at root level) */
  isRoot?: boolean
}

// ── Main recursive component ──────────────────────────────────────────────────

export function FormulaBuilder({ node, onChange, characteristics, valuesMap, isRoot = false }: FormulaBuilderProps) {
  const selectChars  = characteristics.filter(c => c.display_type !== 'number')
  const numberChars  = characteristics.filter(c => c.display_type === 'number')
  const firstCharId  = selectChars[0]?.id ?? characteristics[0]?.id ?? ''
  const firstValueId = valuesMap[firstCharId]?.[0]?.id ?? ''
  const firstNumId   = numberChars[0]?.id ?? ''

  function changeType(type: NodeType) {
    onChange(defaultNode(type, firstCharId, firstValueId))
  }

  // Node-type escape hatch (de-emphasised — power users only)
  const typeSelector = (
    <SmallSelect value={node.type} onChange={t => changeType(t as NodeType)}>
      {NODE_GROUPS.map(group => (
        <optgroup key={group.label} label={group.label}>
          {group.types.map(t => (
            <option key={t} value={t}>{NODE_LABELS[t]}</option>
          ))}
        </optgroup>
      ))}
    </SmallSelect>
  )

  const childProps = { characteristics, valuesMap }

  // ── Root wrapper: preview + templates ─────────────────────────────────────
  const inner = renderNode()

  if (isRoot) {
    return (
      <div className="space-y-4">
        {/* Preview */}
        <div className="rounded bg-muted/40 px-3 py-2 font-mono text-xs text-foreground break-all">
          {formulaToString(node, characteristics, valuesMap)}
        </div>

        {/* Templates */}
        {characteristics.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick templates</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.label}
                  type="button"
                  title={tpl.description}
                  onClick={() => onChange(tpl.build(firstCharId, firstValueId, firstNumId))}
                  className="px-2.5 py-1 rounded border border-input bg-background text-xs hover:bg-muted transition-colors"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Builder tree */}
        <div className="rounded-lg border bg-muted/10 p-3">
          {inner}
        </div>
      </div>
    )
  }

  return inner

  // ── Node renderers ─────────────────────────────────────────────────────────

  function renderNode() {
    // ── number ────────────────────────────────────────────────────────────────
    if (node.type === 'number') {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          {typeSelector}
          <input
            type="number"
            value={node.value}
            onChange={e => onChange({ type: 'number', value: parseFloat(e.target.value) || 0 })}
            className="w-24 rounded border border-input bg-background px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )
    }

    // ── base_price ────────────────────────────────────────────────────────────
    if (node.type === 'base_price') {
      return (
        <div className="flex items-center gap-2">
          {typeSelector}
          <span className="text-xs text-muted-foreground">base price</span>
        </div>
      )
    }

    // ── modifier ──────────────────────────────────────────────────────────────
    if (node.type === 'modifier') {
      return (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {typeSelector}
            <span className="text-xs text-muted-foreground">of characteristic:</span>
          </div>
          <CharPicker
            value={node.char_id}
            chars={selectChars}
            onChange={v => onChange({ type: 'modifier', char_id: v })}
          />
        </div>
      )
    }

    // ── input ─────────────────────────────────────────────────────────────────
    if (node.type === 'input') {
      return (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {typeSelector}
            <span className="text-xs text-muted-foreground">characteristic:</span>
          </div>
          <CharPicker
            value={node.char_id}
            chars={numberChars}
            onChange={v => onChange({ type: 'input', char_id: v })}
          />
        </div>
      )
    }

    // ── is_selected ───────────────────────────────────────────────────────────
    if (node.type === 'is_selected') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {typeSelector}
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Characteristic:</p>
            <CharPicker
              value={node.char_id}
              chars={selectChars}
              onChange={v => onChange({ type: 'is_selected', char_id: v, value_id: '' })}
            />
          </div>
          {node.char_id && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Value:</p>
              <ValuePicker
                charId={node.char_id}
                value={node.value_id}
                valuesMap={valuesMap}
                onChange={v => onChange({ ...node, value_id: v })}
              />
            </div>
          )}
        </div>
      )
    }

    // ── Binary ops ────────────────────────────────────────────────────────────
    if (isBinaryNode(node)) {
      const isLogical = node.type === 'and' || node.type === 'or'
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {typeSelector}
          </div>
          <div className="border-l-2 border-muted pl-3 space-y-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">{isLogical ? 'First condition' : 'Left'}</p>
              <FormulaBuilder
                node={node.left}
                onChange={left => onChange({ ...node, left } as FormulaNode)}
                {...childProps}
              />
            </div>
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-xs font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                {OP_SYMBOL[node.type]}
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">{isLogical ? 'Second condition' : 'Right'}</p>
              <FormulaBuilder
                node={node.right}
                onChange={right => onChange({ ...node, right } as FormulaNode)}
                {...childProps}
              />
            </div>
          </div>
        </div>
      )
    }

    // ── IF / THEN / ELSE ──────────────────────────────────────────────────────
    if (node.type === 'if') {
      const fields = [
        { key: 'condition' as const, label: 'IF',   color: 'border-blue-400/50' },
        { key: 'then'      as const, label: 'THEN', color: 'border-green-400/50' },
        { key: 'else_node' as const, label: 'ELSE', color: 'border-muted' },
      ]
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {typeSelector}
          </div>
          <div className="space-y-2">
            {fields.map(({ key, label, color }) => (
              <div key={key} className={`border-l-2 ${color} pl-3 space-y-1`}>
                <p className="text-xs font-bold text-primary">{label}</p>
                <FormulaBuilder
                  node={node[key]}
                  onChange={updated => onChange({ ...node, [key]: updated })}
                  {...childProps}
                />
              </div>
            ))}
          </div>
        </div>
      )
    }

    return null
  }
}
