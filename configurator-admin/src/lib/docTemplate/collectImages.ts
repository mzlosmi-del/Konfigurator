// Walk the block tree the way the renderers do (entering repeaters and pushing
// scope frames) and collect every distinct URL referenced by a binding-sourced
// image block. Both renderPdf and renderDocx pre-embed these before their
// synchronous build pass. Visibility conditions are ignored — over-collecting a
// few URLs is harmless and cheaper than re-deriving visibility per frame.

import type { Block } from './types'
import type { TemplateContext } from './context'
import { resolveRaw, resolveCollection, type ScopeStack } from './resolvePath'

export function collectBindingImageUrls(blocks: Block[], ctx: TemplateContext): Set<string> {
  const urls = new Set<string>()
  const walk = (bs: Block[], scope: ScopeStack) => {
    for (const b of bs) {
      if (b.kind === 'image' && b.source === 'binding' && b.binding) {
        const url = resolveRaw(ctx, scope, b.binding)
        if (typeof url === 'string' && url) urls.add(url)
      } else if (b.kind === 'repeater') {
        for (const frame of resolveCollection(ctx, scope, b.over)) walk(b.children, [...scope, frame])
      } else if (b.kind === 'group') {
        walk(b.children, scope)
      }
    }
  }
  walk(blocks, [])
  return urls
}
