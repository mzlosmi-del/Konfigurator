// Single shared mapping of the constrained style enums to concrete values, so
// the PDF (pt + pdf-lib rgb), DOCX (half-points + hex), XLSX (points + hex) and
// the HTML preview (px + css) renderers all agree on what "lg / bold / accent"
// means. Palette colours reuse the `C` palette keys from pdf/shared.ts.

import { rgb } from 'pdf-lib'
import { C } from '@/lib/pdf/shared'
import type { StyleSize, StyleColor, BlockStyle, StyleAlign } from './types'

/** Font size in PDF points for each size token. */
export const SIZE_PT: Record<StyleSize, number> = {
  sm:   8,
  base: 10,
  lg:   13,
  xl:   18,
}

/** Heading level → size token. */
export const HEADING_SIZE: Record<1 | 2 | 3, StyleSize> = {
  1: 'xl',
  2: 'lg',
  3: 'base',
}

/** Palette colour → pdf-lib RGB (reuses the shared C palette). */
export const COLOR_RGB: Record<StyleColor, ReturnType<typeof rgb>> = {
  ink:      C.ink,
  muted:    C.muted,
  accent:   C.accent,
  positive: C.positive,
  negative: C.negative,
}

/** Palette colour → hex (for DOCX / XLSX / CSS). Derived from COLOR_RGB so the
 *  two never drift. */
export function colorHex(color: StyleColor): string {
  const c = COLOR_RGB[color]
  const h = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0')
  return `${h(c.red)}${h(c.green)}${h(c.blue)}`.toUpperCase()
}

export function sizePt(style?: BlockStyle): number {
  return SIZE_PT[style?.size ?? 'base']
}

export function isBold(style?: BlockStyle): boolean {
  return style?.weight === 'bold'
}

export function alignOf(style?: BlockStyle): StyleAlign {
  return style?.align ?? 'left'
}

export function colorOf(style?: BlockStyle): StyleColor {
  return style?.color ?? 'ink'
}
