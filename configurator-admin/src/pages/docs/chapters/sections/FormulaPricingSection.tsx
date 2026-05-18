import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { ManualMockup, MockupHotspot } from '@/components/docs/ManualMockup'
import { t } from '@/i18n'

function FormulaBlock({ children }: { children: string }) {
  return (
    <pre className="rounded bg-muted px-3 py-2 text-[11px] font-mono whitespace-pre overflow-x-auto leading-relaxed">
      {children}
    </pre>
  )
}

function ExampleCaption({ what, when }: { what: string; when: string }) {
  return (
    <div className="text-xs text-muted-foreground space-y-1 mt-3">
      <div><span className="font-medium text-foreground">{t('What it does:')}</span> {what}</div>
      <div><span className="font-medium text-foreground">{t('When it fires:')}</span> {when}</div>
    </div>
  )
}

export function FormulaPricingSection() {
  return (
    <div className="space-y-4">
      {/* ── 1. Anatomy of a formula ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Anatomy of a formula')}</CardTitle>
          <CardDescription>
            {t('A formula is a tree of nodes — values at the leaves, operators at the branches. Add as many formulas as you need; their results are summed into the widget\'s total price.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ManualMockup caption={t('Formula editor — existing formulas listed on top, the new-formula card below with a template picker and the node-type tree builder.')}>
            <div className="p-4 space-y-3 text-xs relative">
              {/* Existing formula card */}
              <div className="rounded border bg-card p-2.5 flex items-center justify-between">
                <div>
                  <div className="font-medium">Total price</div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    (((base_price + [Size mod]) + [Material mod]) + [Leg mod])
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-primary/15 text-primary text-[10px] px-1.5 py-0.5 font-medium">{t('Active')}</span>
                  <button className="text-muted-foreground text-[10px]">▾</button>
                </div>
              </div>
              {/* New formula card */}
              <div className="rounded border bg-card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-12">{t('NEW')}</span>
                  <input className="flex-1 rounded border px-2 py-1 text-xs" placeholder={t('Formula name (e.g. \'Size surcharge\', \'Material discount\')')} />
                </div>
                <div className="flex items-center gap-2 pl-14">
                  <span className="text-[10px] text-muted-foreground">{t('Template:')}</span>
                  <span className="rounded border bg-background px-2 py-0.5">Base price × Width × Height ▾</span>
                </div>
                <div className="pl-14 mt-1">
                  <div className="rounded border-l-2 border-primary/50 bg-muted/40 pl-2 py-1.5 text-[10px] font-mono space-y-0.5">
                    <div>multiply (×)</div>
                    <div className="pl-3">├─ multiply (×)</div>
                    <div className="pl-6">│  ├─ base_price</div>
                    <div className="pl-6">│  └─ input: Width</div>
                    <div className="pl-3">└─ input: Height</div>
                  </div>
                  <button className="mt-1.5 rounded border px-1.5 py-0.5 text-[10px] flex items-center gap-1">
                    <Plus className="h-2.5 w-2.5" />
                    {t('Add node')}
                  </button>
                </div>
              </div>
              <MockupHotspot n={1} top="34%" left="48%" label={t('Name your formula')} />
              <MockupHotspot n={2} top="50%" left="44%" label={t('Quick-start templates')} />
              <MockupHotspot n={3} top="80%" left="22%" label={t('Tree builder')} />
              <MockupHotspot n={4} top="6%" left="68%" label={t('Toggle active')} />
            </div>
          </ManualMockup>
          <p className="text-muted-foreground">
            {t('Pick a template to scaffold a common shape, then edit the nodes to fit. Each non-leaf node has a dropdown to change its operator (× to +, > to =, etc.); each leaf has a dropdown to choose what value to read (base price, a modifier, a numeric input, a constant, another formula\'s result).')}
          </p>
        </CardContent>
      </Card>

      {/* ── 2. What nodes can you combine ──────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('What nodes can you combine')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="font-medium mb-1.5">{t('Values (leaves)')}</div>
              <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-5">
                <li><span className="font-mono text-foreground">number</span> — {t('a constant like 200 or 1.21')}</li>
                <li><span className="font-mono text-foreground">base_price</span> — {t('the product\'s base price')}</li>
                <li><span className="font-mono text-foreground">modifier</span> — {t('the price modifier of the value selected in a given characteristic')}</li>
                <li><span className="font-mono text-foreground">input</span> — {t('the current value of a numeric characteristic (Width, Height, Quantity)')}</li>
                <li><span className="font-mono text-foreground">is_selected</span> — {t('true/false: does the customer have a specific value selected')}</li>
                <li><span className="font-mono text-foreground">formula_result</span> — {t('the computed result of another formula on this product')}</li>
              </ul>
            </div>
            <div>
              <div className="font-medium mb-1.5">{t('Operators (branches)')}</div>
              <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-5">
                <li><span className="font-mono text-foreground">+ − × ÷</span> — {t('arithmetic')}</li>
                <li><span className="font-mono text-foreground">{'> ≥ < ≤ ='}</span> — {t('comparisons (return true/false)')}</li>
                <li><span className="font-mono text-foreground">AND, OR</span> — {t('combine comparisons')}</li>
                <li><span className="font-mono text-foreground">IF / THEN / ELSE</span> — {t('pick one of two sub-expressions based on a condition')}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Worked example 1 — sum of modifiers ─────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Example 1 — sum of modifiers (the default shape)')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <FormulaBlock>{`base_price + modifier(Size) + modifier(Material) + modifier(Leg style)

= €299 + €80      + €60             + €30
= €469`}</FormulaBlock>
          <ExampleCaption
            what={t('Adds up the base price and each selected option\'s price modifier — the simplest, most common formula shape.')}
            when={t('Every time the customer changes any of the three characteristics, the total recomputes live. If they pick a smaller size (+€0) and a different material (+€0), the total drops accordingly.')}
          />
          <p className="text-xs text-muted-foreground mt-2 italic">
            {t('Use this whenever each option independently nudges the price. It\'s the same idea as ticking checkboxes on a buy form — modifiers add up, no math required.')}
          </p>
        </CardContent>
      </Card>

      {/* ── 4. Worked example 2 — size-based pricing ──────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Example 2 — size-based pricing (Base price × Width × Height)')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <FormulaBlock>{`base_price × input(Width) × input(Height)

= €50/m² × 1.2 m × 0.8 m
= €48.00`}</FormulaBlock>
          <ExampleCaption
            what={t('Multiplies the base price by two numeric characteristics — typically Width and Height in metres — giving an area-based price.')}
            when={t('Recomputes the moment either number changes in the widget. Made width 1.5 instead of 1.2? Total jumps from €48 to €60 immediately.')}
          />
          <p className="text-xs text-muted-foreground mt-2 italic">
            {t('Use for products priced by area: glass panels, banners, table tops, fabric. Pair with a second formula for fixed surcharges (cuts, edges, delivery) — both formulas sum into the total.')}
          </p>
        </CardContent>
      </Card>

      {/* ── 5. Worked example 3 — conditional surcharge ───────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Example 3 — conditional surcharge (IF / THEN / ELSE)')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <FormulaBlock>{`IF is_selected(Material = Steel)
THEN base_price + 200
ELSE base_price`}</FormulaBlock>
          <ExampleCaption
            what={t('Adds a flat €200 surcharge to the base price, but only when the customer picks Steel as the material. Any other material returns the base price unchanged.')}
            when={t('Every time the Material selection changes. Pick Steel → +€200 added. Switch to Wood → the +€200 disappears.')}
          />
          <p className="text-xs text-muted-foreground mt-2 italic">
            {t('Use IF / THEN / ELSE when one option needs special-case price logic that doesn\'t fit a simple modifier. Keep configuration logic (hide / disable / lock) in Rules and price logic in Formulas — they\'re separate systems for a reason.')}
          </p>
        </CardContent>
      </Card>

      {/* ── 6. Active vs draft ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Active vs draft')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            {t('The widget evaluates every active formula on the product and adds the results into the total. Toggling a formula to inactive keeps it in the editor but stops it from affecting the price — useful for staging price changes before going live.')}
          </p>
          <p>
            {t('Formulas can also reference each other via formula_result, so you can build a "subtotal" formula and reuse it inside a "tax" formula. The widget evaluates them in sort order.')}
          </p>
        </CardContent>
      </Card>

      {/* ── 7. Formula vs Rule vs price modifier ──────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Formula vs Rule vs price modifier — when to use which')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">{t('Price modifier on a value')}</strong> ({t('set in the Characteristics tab')}) — {t('use for "this option adds +€X". Covers 80% of pricing cases with zero math.')}
            </li>
            <li>
              <strong className="text-foreground">{t('Formula')}</strong> — {t('use when the price depends on numeric inputs (m², width × height), interactions between characteristics, or conditional logic.')}
            </li>
            <li>
              <strong className="text-foreground">{t('Rule')}</strong> — {t('never about price (except Lock value + Free of charge for waiving). Use Rules for visibility, defaults, and constraints — what the customer can see and pick.')}
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
