// Document-template block tree + styling types.
//
// This is the JSON definition a tenant authors in the visual builder and that
// the three generic renderers (PDF / DOCX / XLSX) walk to produce a document.
// It is ADDITIVE — it has nothing to do with the existing hardcoded generators.
//
// These same types are mirrored by hand into the `// JSONB interfaces` section
// of `src/types/database.ts` (per CLAUDE.md, database.ts is hand-written), since
// the tree is persisted in `document_templates.definition` (migration 083).

// ── Conditions (predicate AST) ──────────────────────────────────────────────
// Mirrors the discriminated-union style of `FormulaNode` in database.ts but is
// its OWN model with its own evaluator (see conditions.ts). Leaves reference a
// binding-catalogue field path (see bindings.ts).

export type CompareOp =
  | 'is-empty' | 'not-empty'
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'

export type Condition =
  | { type: 'cmp'; field: string; op: CompareOp; value?: string | number }
  | { type: 'and'; clauses: Condition[] }
  | { type: 'or';  clauses: Condition[] }

// ── Styling (constrained) ───────────────────────────────────────────────────
// All enums map to a single shared table (see style.ts) that gives concrete pt
// sizes and palette colours, so PDF / DOCX / XLSX / HTML preview all agree.

export type StyleSize    = 'sm' | 'base' | 'lg' | 'xl'
export type StyleWeight  = 'normal' | 'bold'
export type StyleAlign   = 'left' | 'center' | 'right' | 'justify'
/** Line spacing presets — mapped to concrete values per renderer in style.ts. */
export type StyleSpacing = 'tight' | 'normal' | 'relaxed'
/** Palette keys — resolved against the shared `C` palette from pdf/shared.ts. */
export type StyleColor  = 'ink' | 'muted' | 'accent' | 'positive' | 'negative'

export interface BlockStyle {
  size?:        StyleSize
  weight?:      StyleWeight
  align?:       StyleAlign
  color?:       StyleColor
  lineSpacing?: StyleSpacing
}

// ── Blocks ──────────────────────────────────────────────────────────────────

export type BlockKind =
  | 'text' | 'heading' | 'key-value' | 'line-items-table'
  | 'image' | 'divider' | 'spacer' | 'page-break' | 'repeater' | 'group'

interface BlockBase {
  id:       string
  kind:     BlockKind
  /** Optional show/hide predicate. Block (and its subtree) renders only when
   *  this evaluates true. Absent ⇒ always visible. */
  visible?: Condition
  style?:   BlockStyle
}

/** A literal string that may contain `{{path}}` tokens resolved against the
 *  active scope at render time (see resolvePath.ts / interpolate). */
export type TemplateString = string

export interface TextBlock extends BlockBase {
  kind:    'text'
  content: TemplateString
}

export interface HeadingBlock extends BlockBase {
  kind:    'heading'
  content: TemplateString
  level:   1 | 2 | 3
}

export interface KeyValueRow {
  label: TemplateString
  /** A binding path (e.g. `quotation.customer_name`). Resolved to a string. */
  value: string
}
export interface KeyValueBlock extends BlockBase {
  kind: 'key-value'
  rows: KeyValueRow[]
}

export interface TableColumn {
  header: TemplateString
  /** Binding path resolved against each `line_item` element. */
  value:  string
  align?: StyleAlign
  /** Relative width weight (defaults to 1 across columns). */
  width?: number
}
export interface LineItemsTableBlock extends BlockBase {
  kind:    'line-items-table'
  columns: TableColumn[]
  /** When true, render Subtotal / adjustments / Total summary under the table
   *  using the shared quotations.ts helpers. Defaults to true. */
  showSummary?: boolean
}

export interface ImageBlock extends BlockBase {
  kind:      'image'
  source:    'tenant_logo' | 'binding'
  /** Required when source === 'binding'. A path of catalogue type 'image'. */
  binding?:  string
  maxWidth?: number   // pt
  maxHeight?: number  // pt
}

export interface DividerBlock extends BlockBase {
  kind: 'divider'
}

export interface SpacerBlock extends BlockBase {
  kind:   'spacer'
  height: number   // pt
}

/** Forces a new page in PDF/DOCX (a visible separator row in XLSX). */
export interface PageBreakBlock extends BlockBase {
  kind: 'page-break'
}

/** Collection paths a repeater may loop over. */
export type CollectionPath = 'quotation.line_items' | 'line_item.configuration'

export interface RepeaterBlock extends BlockBase {
  kind:     'repeater'
  over:     CollectionPath
  children: Block[]
  /** When true, each iteration after the first starts on a new page. */
  pageBreakBefore?: boolean
}

export interface GroupBlock extends BlockBase {
  kind:     'group'
  children: Block[]
}

export type Block =
  | TextBlock | HeadingBlock | KeyValueBlock | LineItemsTableBlock
  | ImageBlock | DividerBlock | SpacerBlock | PageBreakBlock | RepeaterBlock | GroupBlock

/** Document-level page options. */
export interface PageOptions {
  /** When true, render a footer with a label + "Page X of Y" on every page. */
  footer?:      boolean
  /** Footer label; defaults to the tenant footer / tenant name when omitted. */
  footerLabel?: string
}

/** Top-level template definition (the `definition` JSONB column). */
export interface DocumentTemplateDefinition {
  /** Schema version for forward migrations. */
  version: 1
  blocks:  Block[]
  /** Optional page-level options (footer / page numbers). */
  page?:   PageOptions
}

export type OutputKind = 'pdf' | 'docx' | 'xlsx'

/** Blocks that contain a child subtree — useful for tree walks. */
export function blockChildren(block: Block): Block[] {
  return block.kind === 'repeater' || block.kind === 'group' ? block.children : []
}
