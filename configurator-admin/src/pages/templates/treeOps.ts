// Pure helpers for manipulating the block tree in the builder and for computing
// which binding scopes are active at a given block's tree position (so the
// property panel only offers valid field paths).

import type { Block, BlockKind } from '@/lib/docTemplate/types'
import type { BindingScope } from '@/lib/docTemplate/bindings'
import { BASE_SCOPES, scopeForCollection } from '@/lib/docTemplate/bindings'

let _seq = 0
export function newBlockId(): string {
  return `b${Date.now().toString(36)}${(_seq++).toString(36)}`
}

/** A blank block of the given kind with sensible defaults. */
export function makeBlock(kind: BlockKind): Block {
  const id = newBlockId()
  switch (kind) {
    case 'text':             return { id, kind, content: 'Text' }
    case 'heading':          return { id, kind, content: 'Heading', level: 2 }
    case 'key-value':        return { id, kind, rows: [{ label: 'Label', value: 'quotation.reference_number' }] }
    case 'line-items-table': return { id, kind, showSummary: true, columns: [
      { header: 'Product', value: 'line_item.product_name' },
      { header: 'Total',   value: 'line_item.line_total', align: 'right' },
    ] }
    case 'image':            return { id, kind, source: 'tenant_logo', maxHeight: 40, maxWidth: 160 }
    case 'divider':          return { id, kind }
    case 'spacer':           return { id, kind, height: 8 }
    case 'repeater':         return { id, kind, over: 'quotation.line_items', children: [] }
    case 'group':            return { id, kind, children: [] }
  }
}

function hasChildren(b: Block): b is Extract<Block, { children: Block[] }> {
  return b.kind === 'repeater' || b.kind === 'group'
}

/** Replace a block (matched by id) anywhere in the tree. */
export function updateBlock(blocks: Block[], id: string, patch: Partial<Block>): Block[] {
  return blocks.map(b => {
    if (b.id === id) return { ...b, ...patch } as Block
    if (hasChildren(b)) return { ...b, children: updateBlock(b.children, id, patch) } as Block
    return b
  })
}

/** Remove a block (by id) from anywhere in the tree. */
export function removeBlock(blocks: Block[], id: string): Block[] {
  return blocks
    .filter(b => b.id !== id)
    .map(b => hasChildren(b) ? ({ ...b, children: removeBlock(b.children, id) } as Block) : b)
}

/** Append a block to a parent's children (parentId null ⇒ top level). */
export function addBlock(blocks: Block[], parentId: string | null, block: Block): Block[] {
  if (parentId === null) return [...blocks, block]
  return blocks.map(b => {
    if (b.id === parentId && hasChildren(b)) return { ...b, children: [...b.children, block] } as Block
    if (hasChildren(b)) return { ...b, children: addBlock(b.children, parentId, block) } as Block
    return b
  })
}

/** Find a block by id. */
export function findBlock(blocks: Block[], id: string): Block | undefined {
  for (const b of blocks) {
    if (b.id === id) return b
    if (hasChildren(b)) {
      const found = findBlock(b.children, id)
      if (found) return found
    }
  }
  return undefined
}

/** Reorder siblings within the same parent (top-level when parentId null). */
export function reorderSiblings(blocks: Block[], parentId: string | null, fromId: string, toId: string): Block[] {
  const move = (arr: Block[]): Block[] => {
    const from = arr.findIndex(b => b.id === fromId)
    const to   = arr.findIndex(b => b.id === toId)
    if (from < 0 || to < 0) return arr
    const next = [...arr]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
  }
  if (parentId === null) return move(blocks)
  return blocks.map(b => {
    if (b.id === parentId && hasChildren(b)) return { ...b, children: move(b.children) } as Block
    if (hasChildren(b)) return { ...b, children: reorderSiblings(b.children, parentId, fromId, toId) } as Block
    return b
  })
}

/** Compute the set of binding scopes active at a block's position by walking the
 *  tree and accumulating the scope each enclosing repeater contributes. Returns
 *  null if the id is not found. */
export function activeScopesFor(blocks: Block[], id: string, inherited: Set<BindingScope> = new Set(BASE_SCOPES)): Set<BindingScope> | null {
  for (const b of blocks) {
    if (b.id === id) return new Set(inherited)
    if (hasChildren(b)) {
      const childInherited = new Set(inherited)
      if (b.kind === 'repeater') {
        const s = scopeForCollection(b.over)
        if (s) childInherited.add(s)
      }
      const found = activeScopesFor(b.children, id, childInherited)
      if (found) return found
    }
  }
  return null
}

/** The scope a repeater itself can iterate over depends on its position: a
 *  `line_item.configuration` repeater is only valid when `line_item` is in
 *  scope. Returns the collection paths available at a position. */
export function collectionsForScopes(active: Set<BindingScope>): ('quotation.line_items' | 'line_item.configuration')[] {
  const out: ('quotation.line_items' | 'line_item.configuration')[] = ['quotation.line_items']
  if (active.has('line_item')) out.push('line_item.configuration')
  return out
}
