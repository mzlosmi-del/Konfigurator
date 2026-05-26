// HTML/CSS approximation of the block tree, used as the live preview in the
// builder. It walks the SAME tree as the renderers against the SAME
// TemplateContext (built from quotationFixture), so what the tenant sees here
// closely matches the generated PDF/DOCX/XLSX. Pixel-exact fidelity is not the
// goal — fast feedback on every edit is.

import { Fragment } from 'react'
import type { Block, BlockStyle } from '@/lib/docTemplate/types'
import type { TemplateContext } from '@/lib/docTemplate/context'
import { evaluateCondition } from '@/lib/docTemplate/conditions'
import { interpolate, resolveDisplay, resolveCollection, type ScopeStack } from '@/lib/docTemplate/resolvePath'
import { SIZE_PT, HEADING_SIZE, colorHex, sizePt, isBold, alignOf, colorOf, lineSpacingOf } from '@/lib/docTemplate/style'

interface Props {
  blocks:        Block[]
  ctx:           TemplateContext
  /** Currently-selected block id, highlighted in the canvas. */
  selectedId?:   string
  onSelectBlock?: (id: string) => void
}

function cssStyle(style: BlockStyle | undefined, ptOverride?: number): React.CSSProperties {
  return {
    fontSize:   `${ptOverride ?? sizePt(style)}px`,
    fontWeight: isBold(style) ? 700 : 400,
    textAlign:  alignOf(style) as React.CSSProperties['textAlign'],
    lineHeight: lineSpacingOf(style),
    color:      `#${colorHex(colorOf(style))}`,
  }
}

export function TemplateCanvas({ blocks, ctx, selectedId, onSelectBlock }: Props) {
  return (
    <div
      className="bg-white shadow-md text-[#151928] font-sans p-8 mx-auto"
      style={{ width: 540, minHeight: 762, fontSize: 11 }}
    >
      <BlockList blocks={blocks} ctx={ctx} scope={[]} selectedId={selectedId} onSelectBlock={onSelectBlock} />
    </div>
  )
}

function BlockList({ blocks, ctx, scope, selectedId, onSelectBlock }: {
  blocks: Block[]; ctx: TemplateContext; scope: ScopeStack; selectedId?: string; onSelectBlock?: (id: string) => void
}) {
  return (
    <>
      {blocks.map(block => {
        const visible = evaluateCondition(block.visible, ctx, scope)
        return (
          <BlockView
            key={block.id}
            block={block}
            ctx={ctx}
            scope={scope}
            hidden={!visible}
            selectedId={selectedId}
            onSelectBlock={onSelectBlock}
          />
        )
      })}
    </>
  )
}

function BlockView({ block, ctx, scope, hidden, selectedId, onSelectBlock }: {
  block: Block; ctx: TemplateContext; scope: ScopeStack; hidden: boolean; selectedId?: string; onSelectBlock?: (id: string) => void
}) {
  const selected = block.id === selectedId
  const wrap = (children: React.ReactNode) => (
    <div
      onClick={onSelectBlock ? (e) => { e.stopPropagation(); onSelectBlock(block.id) } : undefined}
      className={[
        'rounded -mx-1 px-1 py-px transition-colors',
        onSelectBlock ? 'cursor-pointer hover:bg-blue-50/60' : '',
        selected ? 'ring-1 ring-blue-400 bg-blue-50/40' : '',
        hidden ? 'opacity-30' : '',
      ].join(' ')}
      title={hidden ? 'Hidden by its condition with this sample data' : undefined}
    >
      {children}
    </div>
  )

  switch (block.kind) {
    case 'heading': {
      const pt = SIZE_PT[HEADING_SIZE[block.level]]
      return wrap(<div style={{ ...cssStyle({ ...block.style, weight: 'bold' }, pt), margin: '6px 0 3px' }}>
        {interpolate(block.content, ctx, scope) || <Placeholder text="heading" />}
      </div>)
    }
    case 'text':
      return wrap(<div style={{ ...cssStyle(block.style), margin: '2px 0', whiteSpace: 'pre-wrap' }}>
        {interpolate(block.content, ctx, scope) || <Placeholder text="text" />}
      </div>)
    case 'key-value':
      return wrap(<div style={{ margin: '2px 0' }}>
        {block.rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, fontSize: `${sizePt(block.style)}px` }}>
            <span style={{ fontWeight: 700, color: '#6C7179', minWidth: 110 }}>{interpolate(r.label, ctx, scope)}</span>
            <span style={{ color: `#${colorHex(colorOf(block.style))}` }}>{resolveDisplay(ctx, scope, r.value)}</span>
          </div>
        ))}
      </div>)
    case 'line-items-table':
      return wrap(<TablePreview block={block} ctx={ctx} scope={scope} />)
    case 'image':
      return wrap(<ImagePreview block={block} ctx={ctx} />)
    case 'divider':
      return wrap(<div style={{ borderTop: '1px solid #D2D4D8', margin: '6px 0' }} />)
    case 'spacer':
      return wrap(<div style={{ height: block.height }} />)
    case 'page-break':
      return wrap(
        <div className="flex items-center gap-2 my-2 text-[9px] uppercase tracking-widest text-[#ADB1B7] select-none">
          <div className="flex-1 border-t border-dashed border-[#ADB1B7]" />
          {'Page break'}
          <div className="flex-1 border-t border-dashed border-[#ADB1B7]" />
        </div>
      )
    case 'repeater': {
      const frames = resolveCollection(ctx, scope, block.over)
      return wrap(
        <div className="border-l-2 border-dashed border-blue-200 pl-2">
          {block.pageBreakBefore && (
            <div className="text-[8px] uppercase tracking-wider text-[#ADB1B7] mb-0.5">{'↵ new page per item'}</div>
          )}
          {frames.length === 0
            ? <Placeholder text={`repeat: ${block.over} (no items)`} />
            : frames.map((frame, i) => (
                <Fragment key={i}>
                  <BlockList blocks={block.children} ctx={ctx} scope={[...scope, frame]}
                    selectedId={selectedId} onSelectBlock={onSelectBlock} />
                </Fragment>
              ))}
        </div>
      )
    }
    case 'group':
      return wrap(
        <div>
          <BlockList blocks={block.children} ctx={ctx} scope={scope}
            selectedId={selectedId} onSelectBlock={onSelectBlock} />
        </div>
      )
  }
}

function TablePreview({ block, ctx, scope }: { block: Extract<Block, { kind: 'line-items-table' }>; ctx: TemplateContext; scope: ScopeStack }) {
  const frames = resolveCollection(ctx, scope, 'quotation.line_items')
  const totalWeight = block.columns.reduce((s, c) => s + (c.width ?? 1), 0)
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, margin: '2px 0' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #D2D4D8' }}>
          {block.columns.map((c, i) => (
            <th key={i} style={{ textAlign: c.align ?? 'left', color: '#6C7179', fontWeight: 700, padding: '3px 2px', width: `${(100 * (c.width ?? 1)) / totalWeight}%` }}>
              {interpolate(c.header, ctx, scope)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {frames.map((frame, ri) => (
          <tr key={ri} style={{ background: ri % 2 ? '#F7F8FB' : undefined }}>
            {block.columns.map((c, ci) => (
              <td key={ci} style={{ textAlign: c.align ?? 'left', padding: '3px 2px' }}>
                {resolveDisplay(ctx, [...scope, frame], c.value)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {block.showSummary !== false && (
        <tfoot>
          <tr><td colSpan={block.columns.length} style={{ paddingTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, color: '#6C7179' }}>
              <span>Subtotal</span><span>{ctx.quotation.subtotal.toFixed(2)} {ctx.currency}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, fontWeight: 700, color: '#154BE4' }}>
              <span>Total</span><span>{ctx.quotation.total.toFixed(2)} {ctx.currency}</span>
            </div>
          </td></tr>
        </tfoot>
      )}
    </table>
  )
}

function ImagePreview({ block, ctx }: { block: Extract<Block, { kind: 'image' }>; ctx: TemplateContext }) {
  const url = block.source === 'tenant_logo' ? ctx.tenant.logo_url : null
  if (url) return <img src={url} alt="" style={{ maxHeight: block.maxHeight ?? 40, maxWidth: block.maxWidth ?? 160, objectFit: 'contain' }} />
  // No image available with the sample data — show the brand name fallback that
  // the renderers also use.
  return <div style={{ fontWeight: 700, fontSize: SIZE_PT.lg }}>{ctx.tenant.name}</div>
}

function Placeholder({ text }: { text: string }) {
  return <span className="text-[#ADB1B7] italic">[{text}]</span>
}
