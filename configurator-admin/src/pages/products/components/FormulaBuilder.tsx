import type { FormulaNode } from '@/types/database'
import type { Characteristic, CharacteristicValue } from '@/types/database'

// ── Node type helpers ─────────────────────────────────────────────────────────

type NodeType = FormulaNode['type']

const NODE_GROUPS: { label: string; types: NodeType[] }[] = [
  { label: 'Values',     types: ['number', 'base_price', 'modifier', 'input'] },
  { label: 'Selection',  types: ['is_selected'] },
  { label: 'Arithmetic', types: ['add', 'subtract', 'multiply', 'divide'] },
  { label: 'Compare',    types: ['gt', 'gte', 'lt', 'lte', 'eq'] },
  { label: 'Logic',      types: ['and', 'or'] },
  { label: 'Conditional',types: ['if'] },
]

const NODE_LABELS: Record<NodeType, string> = {
  number:     'Number',
  base_price: 'Base price',
  modifier:   'Price modifier',
  input:      'Numeric input',
  is_selected:'Is selected',
  add:        'Add (+)',
  subtract:   'Subtract (−)',
  multiply:   'Multiply (×)',
  divide:     'Divide (÷)',
  gt:         'Greater than (>)',
  gte:        'Greater or equal (≥)',
  lt:         'Less than (<)',
  lte:        'Less or equal (≤)',
  eq:         'Equal (=)',
  and:        'AND',
  or:         'OR',
  if:         'IF / THEN / ELSE',
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
    case 'number':     return { type: 'number', value: 0 }
    case 'base_price': return { type: 'base_price' }
    case 'modifier':   return { type: 'modifier', char_id: firstCharId }
    case 'input':      return { type: 'input',    char_id: firstCharId }
    case 'is_selected':return { type: 'is_selected', char_id: firstCharId, value_id: firstValueId }
    case 'if':         return { type: 'if', condition: zero, then: zero, else_node: zero }
    default:           return { type, left: zero, right: zero } as FormulaNode
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface FormulaBuilderProps {
  node: FormulaNode
  onChange: (node: FormulaNode) => void
  characteristics: Characteristic[]
  valuesMap: Record<string, CharacteristicValue[]>
  depth?: number
}

// ── Inline small Select helper ────────────────────────────────────────────────

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
      className={`rounded border border-input bg-background px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${className}`}
    >
      {children}
    </select>
  )
}

// ── Main recursive component ──────────────────────────────────────────────────

export function FormulaBuilder({ node, onChange, characteristics, valuesMap, depth = 0 }: FormulaBuilderProps) {
  const indent = depth * 16
  const selectChars = characteristics.filter(c => c.display_type !== 'number')
  const numberChars = characteristics.filter(c => c.display_type === 'number')
  const firstCharId  = characteristics[0]?.id ?? ''
  const firstValId   = valuesMap[firstCharId]?.[0]?.id ?? ''

  function changeType(type: NodeType) {
    onChange(defaultNode(type, firstCharId, firstValId))
  }

  // ── Type selector ─────────────────────────────────────────────────────────
  const typeSelector = (
    <SmallSelect value={node.type} onChange={t => changeType(t as NodeType)} className="font-medium">
      {NODE_GROUPS.map(group => (
        <optgroup key={group.label} label={group.label}>
          {group.types.map(t => (
            <option key={t} value={t}>{NODE_LABELS[t]}</option>
          ))}
        </optgroup>
      ))}
    </SmallSelect>
  )

  // ── Leaf: number ──────────────────────────────────────────────────────────
  if (node.type === 'number') {
    return (
      <div className="flex items-center gap-2 flex-wrap" style={{ marginLeft: indent }}>
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

  // ── Leaf: base_price ──────────────────────────────────────────────────────
  if (node.type === 'base_price') {
    return (
      <div className="flex items-center gap-2" style={{ marginLeft: indent }}>
        {typeSelector}
      </div>
    )
  }

  // ── Leaf: modifier ────────────────────────────────────────────────────────
  if (node.type === 'modifier') {
    return (
      <div className="flex items-center gap-2 flex-wrap" style={{ marginLeft: indent }}>
        {typeSelector}
        <SmallSelect value={node.char_id} onChange={v => onChange({ type: 'modifier', char_id: v })}>
          <option value="">Select characteristic…</option>
          {selectChars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SmallSelect>
      </div>
    )
  }

  // ── Leaf: input ───────────────────────────────────────────────────────────
  if (node.type === 'input') {
    return (
      <div className="flex items-center gap-2 flex-wrap" style={{ marginLeft: indent }}>
        {typeSelector}
        <SmallSelect value={node.char_id} onChange={v => onChange({ type: 'input', char_id: v })}>
          <option value="">Select numeric input…</option>
          {numberChars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SmallSelect>
      </div>
    )
  }

  // ── Leaf: is_selected ─────────────────────────────────────────────────────
  if (node.type === 'is_selected') {
    const values = valuesMap[node.char_id] ?? []
    return (
      <div className="flex items-center gap-2 flex-wrap" style={{ marginLeft: indent }}>
        {typeSelector}
        <SmallSelect
          value={node.char_id}
          onChange={v => onChange({ type: 'is_selected', char_id: v, value_id: '' })}
        >
          <option value="">Select characteristic…</option>
          {selectChars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SmallSelect>
        <span className="text-xs text-muted-foreground">=</span>
        <SmallSelect
          value={node.value_id}
          onChange={v => onChange({ ...node, value_id: v })}
        >
          <option value="">Select value…</option>
          {values.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </SmallSelect>
      </div>
    )
  }

  // ── Binary ops (arithmetic + comparison + logical) ────────────────────────
  if (isBinaryNode(node)) {
    return (
      <div className="space-y-1" style={{ marginLeft: indent }}>
        <div className="flex items-center gap-2">
          {typeSelector}
        </div>
        <div className="border-l-2 border-muted pl-3 space-y-1.5">
          <div className="flex items-start gap-1.5">
            <span className="text-xs text-muted-foreground w-8 mt-1 shrink-0">Left</span>
            <div className="flex-1">
              <FormulaBuilder
                node={node.left}
                onChange={left => onChange({ ...node, left } as FormulaNode)}
                characteristics={characteristics}
                valuesMap={valuesMap}
                depth={0}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 py-0.5">
            <span className="text-xs font-bold text-primary w-8 shrink-0">{OP_SYMBOL[node.type]}</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-xs text-muted-foreground w-8 mt-1 shrink-0">Right</span>
            <div className="flex-1">
              <FormulaBuilder
                node={node.right}
                onChange={right => onChange({ ...node, right } as FormulaNode)}
                characteristics={characteristics}
                valuesMap={valuesMap}
                depth={0}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── IF / THEN / ELSE ──────────────────────────────────────────────────────
  if (node.type === 'if') {
    return (
      <div className="space-y-1" style={{ marginLeft: indent }}>
        <div className="flex items-center gap-2">
          {typeSelector}
        </div>
        <div className="border-l-2 border-primary/30 pl-3 space-y-2">
          {(['condition', 'then', 'else_node'] as const).map(field => {
            const labels = { condition: 'IF', then: 'THEN', else_node: 'ELSE' }
            return (
              <div key={field} className="flex items-start gap-1.5">
                <span className="text-xs font-bold text-primary w-10 mt-1 shrink-0">{labels[field]}</span>
                <div className="flex-1">
                  <FormulaBuilder
                    node={node[field]}
                    onChange={updated => onChange({ ...node, [field]: updated })}
                    characteristics={characteristics}
                    valuesMap={valuesMap}
                    depth={0}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return null
}
