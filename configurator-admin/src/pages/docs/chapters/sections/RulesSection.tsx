import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowRight, X, Plus } from 'lucide-react'
import { ManualMockup, MockupHotspot } from '@/components/docs/ManualMockup'
import { t } from '@/i18n'

function RuleExampleVisual({ ifText, thenText, thenTone }: { ifText: string; thenText: string; thenTone?: 'default' | 'danger' | 'lock' }) {
  const thenClass =
    thenTone === 'danger' ? 'border-red-300 bg-red-50 dark:bg-red-950/40'
    : thenTone === 'lock' ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/40'
    : 'border-primary/30 bg-primary/5'
  return (
    <div className="flex items-stretch gap-2 flex-wrap">
      <div className="rounded border bg-card px-3 py-2 text-xs min-w-[150px] flex-1">
        <div className="text-[10px] uppercase tracking-wider text-primary font-bold mb-0.5">{t('IF')}</div>
        <div className="font-mono">{ifText}</div>
      </div>
      <div className="flex items-center text-muted-foreground">
        <ArrowRight className="h-4 w-4" />
      </div>
      <div className={`rounded border px-3 py-2 text-xs min-w-[150px] flex-1 ${thenClass}`}>
        <div className="text-[10px] uppercase tracking-wider text-primary font-bold mb-0.5">{t('THEN')}</div>
        <div className="font-mono">{thenText}</div>
      </div>
    </div>
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

export function RulesSection() {
  return (
    <div className="space-y-4">
      {/* ── 1. Anatomy of a rule ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Anatomy of a rule')}</CardTitle>
          <CardDescription>
            {t('Every rule is a pair: an IF block (the condition) and a THEN block (one or more effects).')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ManualMockup caption={t('Rules editor — IF / THEN structure with a mode toggle, predicate rows, and effect rows.')}>
            <div className="p-4 space-y-3 text-xs relative">
              {/* IF block */}
              <div className="rounded border bg-card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary w-12">{t('IF')}</span>
                  <div className="flex gap-1">
                    <button className="rounded px-2 py-0.5 text-[10px] bg-primary text-primary-foreground font-medium">{t('ALL match (AND)')}</button>
                    <button className="rounded px-2 py-0.5 text-[10px] border">{t('ANY match (OR)')}</button>
                  </div>
                  <button className="ml-auto rounded border px-1.5 py-0.5 text-[10px] flex items-center gap-1">
                    <Plus className="h-2.5 w-2.5" />
                    {t('Add predicate')}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 pl-14">
                  <span className="rounded border bg-background px-2 py-0.5">Opening ▾</span>
                  <span className="rounded border bg-background px-2 py-0.5">=</span>
                  <span className="rounded border bg-background px-2 py-0.5">Fixed ▾</span>
                  <button className="text-muted-foreground"><X className="h-3 w-3" /></button>
                </div>
              </div>
              {/* THEN block */}
              <div className="rounded border bg-card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary w-12">{t('THEN')}</span>
                  <button className="rounded border px-1.5 py-0.5 text-[10px] flex items-center gap-1">
                    <Plus className="h-2.5 w-2.5" />
                    {t('Add effect')}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 pl-14 flex-wrap">
                  <span className="rounded border bg-background px-2 py-0.5">{t('Hide value')} ▾</span>
                  <span className="rounded border bg-background px-2 py-0.5">Glazing · Triple ▾</span>
                  <button className="text-muted-foreground"><X className="h-3 w-3" /></button>
                </div>
              </div>
              <MockupHotspot n={1} top="14%" left="22%" label={t('ALL vs ANY')} />
              <MockupHotspot n={2} top="14%" left="68%" label={t('Add predicate')} />
              <MockupHotspot n={3} top="58%" left="14%" label={t('Effect kind')} />
              <MockupHotspot n={4} top="58%" left="72%" label={t('Delete row')} />
            </div>
          </ManualMockup>
          <p className="text-muted-foreground">
            {t('Predicates can be Value conditions (characteristic = / ≠ value) or Numeric conditions (numeric expression compared with > ≥ < ≤ = ≠). Add more predicates and pick ALL or ANY to combine them. Add as many effects as the rule needs — they all fire when the condition is met.')}
          </p>
        </CardContent>
      </Card>

      {/* ── 2. The six effect kinds ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('The six effect kinds')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">{t('Hide value')}</strong> — {t('the value disappears from the widget UI as if it didn\'t exist.')}
            </li>
            <li>
              <strong className="text-foreground">{t('Disable value')}</strong> — {t('the value is still visible but greyed out — useful when you want the customer to see why an option is unavailable.')}
            </li>
            <li>
              <strong className="text-foreground">{t('Set default (value)')}</strong> — {t('auto-selects a value the moment the condition is met. The customer can still change it.')}
            </li>
            <li>
              <strong className="text-foreground">{t('Lock value')}</strong> — {t('forces a value and makes it read-only. Tick "Free of charge (included)" to waive its price modifier — useful when the locked value is bundled into another option\'s premium.')}
            </li>
            <li>
              <strong className="text-foreground">{t('Set default (number)')}</strong> — {t('sets a numeric input to the result of an expression (can reference other characteristics and constants).')}
            </li>
            <li>
              <strong className="text-foreground">{t('Lock number')}</strong> — {t('same as above, but the field is read-only.')}
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* ── 3. Worked example 1 ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Example 1 — hide impossible combinations')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <RuleExampleVisual
            ifText="Opening = Fixed"
            thenText="Hide value: Glazing = Triple"
            thenTone="danger"
          />
          <ExampleCaption
            what={t('Removes the Triple glazing option from the widget entirely.')}
            when={t('The instant the customer picks Opening = Fixed. If they switch back to a different opening, the Triple option reappears.')}
          />
          <p className="text-xs text-muted-foreground mt-2 italic">
            {t('Why: fixed windows can\'t physically take triple glazing — the glazing needs a casement or tilt-turn mechanism. Hiding rather than disabling keeps the UI clean for the most common workflow.')}
          </p>
        </CardContent>
      </Card>

      {/* ── 4. Worked example 2 ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Example 2 — lock a dependent default for free')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <RuleExampleVisual
            ifText="Material = Wood"
            thenText="Lock value: Handle = Brass · Free of charge"
            thenTone="lock"
          />
          <ExampleCaption
            what={t('Forces the Handle to Brass and waives its +€20 modifier. The customer sees Brass pre-selected and read-only.')}
            when={t('Whenever Wood is the selected Material. Switching to a different material releases the lock and the handle becomes editable again.')}
          />
          <p className="text-xs text-muted-foreground mt-2 italic">
            {t('Why: the brass handle is bundled into the wood premium — charging again would double-bill. The "Free of charge (included)" checkbox on Lock value is exactly for this case.')}
          </p>
        </CardContent>
      </Card>

      {/* ── 5. Worked example 3 ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Example 3 — numeric guard')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <RuleExampleVisual
            ifText="Width > 1200"
            thenText="Disable value: Glazing = Single"
          />
          <ExampleCaption
            what={t('Greys out the Single glazing option (still visible, not clickable).')}
            when={t('Whenever the Width numeric input crosses 1200 mm. Drop it back below 1200 and Single glazing becomes selectable again.')}
          />
          <p className="text-xs text-muted-foreground mt-2 italic">
            {t('Why: single glazing isn\'t structurally sound for wide units. Disabling rather than hiding keeps the option visible so the customer understands why it\'s unavailable — better UX than silent removal.')}
          </p>
        </CardContent>
      </Card>

      {/* ── 6. Quick tips ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('Quick tips')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1.5 text-muted-foreground list-disc pl-5">
            <li>{t('Rules re-evaluate on every selection change — no save needed in the widget.')}</li>
            <li>{t('A single rule can have multiple effects — they all fire together when the condition is met.')}</li>
            <li>{t('Numeric conditions read the current value of the numeric input, not the modifier.')}</li>
            <li>{t('If a rule\'s condition is not met, none of its effects apply — there\'s no "ELSE" — write a second rule with the opposite condition if you need one.')}</li>
            <li>{t('Rules never affect price directly. To waive a price modifier, use Lock value with "Free of charge".')}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
