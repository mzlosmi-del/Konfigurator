// Multilevel heading numbering, shared by all three renderers and the preview
// canvas. A single HeadingNumberer is created per render pass and advanced as
// numbered headings are emitted in document order, producing decimal prefixes
// like "1.", "1.1.", "2." — matching the hardcoded tech-spec's scheme.

export class HeadingNumberer {
  // counters[0] = level 1, counters[1] = level 2, counters[2] = level 3.
  private counters = [0, 0, 0]

  /** Advance the counter for a level-`level` heading and return its prefix
   *  (e.g. "1.2."). Incrementing a level resets all deeper levels. */
  next(level: 1 | 2 | 3): string {
    const i = level - 1
    this.counters[i] += 1
    for (let j = i + 1; j < this.counters.length; j++) this.counters[j] = 0
    return this.counters.slice(0, level).join('.') + '.'
  }
}

/** Whether a heading should be numbered: the document master switch must be on
 *  AND the heading must opt in. */
export function headingIsNumbered(docNumbering: boolean | undefined, headingNumbered: boolean | undefined): boolean {
  return !!docNumbering && !!headingNumbered
}

/** Prepend the number prefix to already-resolved heading text. */
export function withNumber(prefix: string, text: string): string {
  return prefix ? `${prefix} ${text}` : text
}
