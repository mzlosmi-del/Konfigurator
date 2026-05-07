import { useEffect, useState } from 'react'
import { BarChart2, Eye, Send, TrendingUp, DollarSign, Lock, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/components/auth/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { t } from '@/i18n'

// ── Types ────────────────────────────────────────────────────────────────────

interface EventRow {
  event_type: string
  payload:    Record<string, unknown>
  created_at: string
  product_id: string
  session_id: string
}

interface DayStat { day: string; views: number; inquiries: number }

interface ProductStat {
  product_id: string
  name: string
  views: number
  inquiries: number
  conversion: number
}

interface PriceBucket { label: string; count: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function computePriceBuckets(prices: number[]): PriceBucket[] {
  if (prices.length === 0) return []
  const max = Math.max(...prices)
  if (max === 0) return [{ label: '0', count: prices.length }]
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)))
  const ceiling   = Math.ceil(max / magnitude) * magnitude
  const step      = ceiling / 5
  return Array.from({ length: 5 }, (_, i) => {
    const lo = i * step
    const hi = (i + 1) * step
    return {
      label: i === 4
        ? `${lo.toLocaleString()}+`
        : `${lo.toLocaleString()}–${hi.toLocaleString()}`,
      count: prices.filter(p => (i === 4 ? p >= lo : p >= lo && p < hi)).length,
    }
  })
}

// ── Tiny inline SVG sparkline ─────────────────────────────────────────────────

function Sparkline({ data, color = '#6366f1' }: { data: number[]; color?: string }) {
  if (data.length < 2) return <div className="h-10" />
  const max  = Math.max(...data, 1)
  const W    = 200
  const H    = 40
  const step = W / (data.length - 1)
  const pts  = data.map((v, i) => `${i * step},${H - (v / max) * H}`)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Summary card ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, sparkData, color,
}: {
  icon: typeof Eye; label: string; value: string; sub?: string
  sparkData?: number[]; color?: string
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-0.5">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <Icon className="h-5 w-5 text-muted-foreground/50" />
        </div>
        {sparkData && <Sparkline data={sparkData} color={color} />}
      </CardContent>
    </Card>
  )
}

// ── Horizontal bar row ────────────────────────────────────────────────────────

function BarRow({
  label, sub, count, maxCount, color = 'bg-indigo-500',
}: {
  label: string; sub?: string; count: number; maxCount: number; color?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-44 shrink-0 min-w-0">
        <p className="text-xs font-medium truncate">{label}</p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${(count / maxCount) * 100}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{count}</span>
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: string }) {
  return <h2 className="text-sm font-semibold mb-3">{children}</h2>
}

// ── Advanced gate ─────────────────────────────────────────────────────────────

function AdvancedGate() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center py-10 text-center gap-3">
        <Lock className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium">{t('Advanced analytics')}</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          {t('Funnel analysis, per-characteristic drop-off, value frequency and CSV export are available on the Growth plan.')}
        </p>
        <a href="/settings" className="mt-1 text-xs text-primary underline underline-offset-2">
          {t('Upgrade plan →')}
        </a>
      </CardContent>
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const { tenant, planLimits } = useAuthContext()
  const isAdvanced = planLimits?.analytics === 'advanced'

  const [loading, setLoading]           = useState(true)
  const [events, setEvents]             = useState<EventRow[]>([])
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [charNames, setCharNames]       = useState<Record<string, string>>({})
  const [valueNames, setValueNames]     = useState<Record<string, string>>({})
  const [quotConversion, setQuotConversion] = useState({ total: 0, fromWidget: 0, accepted: 0 })

  useEffect(() => {
    if (!tenant) return

    const since = new Date()
    since.setDate(since.getDate() - 30)
    const sinceIso = since.toISOString()

    Promise.all([
      supabase
        .from('widget_events')
        .select('event_type, payload, created_at, product_id, session_id')
        .eq('tenant_id', tenant.id)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: true })
        .limit(10000),
      supabase
        .from('products')
        .select('id, name')
        .eq('tenant_id', tenant.id)
        .eq('is_template', false),
      supabase
        .from('characteristics')
        .select('id, name')
        .eq('tenant_id', tenant.id),
      supabase
        .from('characteristic_values')
        .select('id, label')
        .eq('tenant_id', tenant.id),
      supabase
        .from('quotations')
        .select('status, source_inquiry_id')
        .eq('tenant_id', tenant.id)
        .gte('created_at', sinceIso),
    ]).then(([evRes, prRes, charRes, valRes, quotRes]) => {
      setEvents((evRes.data ?? []) as EventRow[])

      const names: Record<string, string> = {}
      for (const p of (prRes.data ?? []) as { id: string; name: string }[]) names[p.id] = p.name
      setProductNames(names)

      const cnames: Record<string, string> = {}
      for (const c of (charRes.data ?? []) as { id: string; name: string }[]) cnames[c.id] = c.name
      setCharNames(cnames)

      const vnames: Record<string, string> = {}
      for (const v of (valRes.data ?? []) as { id: string; label: string }[]) vnames[v.id] = v.label
      setValueNames(vnames)

      const quots = (quotRes.data ?? []) as { status: string; source_inquiry_id: string | null }[]
      const fromWidget = quots.filter(q => q.source_inquiry_id != null)
      const accepted   = fromWidget.filter(q => q.status === 'accepted_no_changes' || q.status === 'accepted_with_changes')
      setQuotConversion({ total: quots.length, fromWidget: fromWidget.length, accepted: accepted.length })

      setLoading(false)
    })
  }, [tenant])

  // ── Aggregate ──────────────────────────────────────────────────────────────

  const views     = events.filter(e => e.event_type === 'view').length
  const inquiries = events.filter(e => e.event_type === 'inquiry_submitted').length
  const conversion = views > 0 ? ((inquiries / views) * 100).toFixed(1) : '0.0'

  const prices = events
    .filter(e => e.event_type === 'inquiry_submitted' && typeof e.payload?.price === 'number')
    .map(e => e.payload.price as number)
  const avgPrice = prices.length > 0
    ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)
    : '—'

  // 30-day daily breakdown for sparklines
  const dayMap: Record<string, DayStat> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const k = d.toISOString().slice(0, 10)
    dayMap[k] = { day: k, views: 0, inquiries: 0 }
  }
  for (const e of events) {
    const k = e.created_at.slice(0, 10)
    if (!dayMap[k]) continue
    if (e.event_type === 'view')              dayMap[k].views++
    if (e.event_type === 'inquiry_submitted') dayMap[k].inquiries++
  }
  const days           = Object.values(dayMap)
  const sparkViews     = days.map(d => d.views)
  const sparkInquiries = days.map(d => d.inquiries)

  // Per-product stats
  const productStats: ProductStat[] = Object.entries(
    events.reduce<Record<string, { views: number; inquiries: number }>>((acc, e) => {
      if (!acc[e.product_id]) acc[e.product_id] = { views: 0, inquiries: 0 }
      if (e.event_type === 'view')              acc[e.product_id].views++
      if (e.event_type === 'inquiry_submitted') acc[e.product_id].inquiries++
      return acc
    }, {})
  )
    .map(([product_id, s]) => ({
      product_id,
      name:       productNames[product_id] ?? product_id.slice(0, 8),
      views:      s.views,
      inquiries:  s.inquiries,
      conversion: s.views > 0 ? (s.inquiries / s.views) * 100 : 0,
    }))
    .sort((a, b) => b.views - a.views)

  // ── Advanced aggregations ──────────────────────────────────────────────────

  const started = events.filter(e => e.event_type === 'inquiry_started').length

  // Most-interacted characteristics (product × char)
  const charFreq = events
    .filter(e => e.event_type === 'characteristic_changed' && typeof e.payload?.char_id === 'string')
    .reduce<Record<string, number>>((acc, e) => {
      const k = `${e.product_id}:::${e.payload.char_id as string}`
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  const topChars = Object.entries(charFreq).sort((a, b) => b[1] - a[1]).slice(0, 8)

  // 1. Value frequency (product × char × value)
  const valueFreq = events
    .filter(e =>
      e.event_type === 'characteristic_changed' &&
      typeof e.payload?.char_id === 'string' &&
      typeof e.payload?.value_id === 'string'
    )
    .reduce<Record<string, number>>((acc, e) => {
      const k = `${e.product_id}:::${e.payload.char_id as string}:::${e.payload.value_id as string}`
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  const topValues = Object.entries(valueFreq).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // 2. Price distribution
  const priceBuckets = computePriceBuckets(prices)

  // 3. Drop-off by characteristic — last char changed before abandonment
  const sessionMap: Record<string, EventRow[]> = {}
  for (const e of events) {
    if (!sessionMap[e.session_id]) sessionMap[e.session_id] = []
    sessionMap[e.session_id].push(e)
  }
  const dropOffFreq = Object.values(sessionMap)
    .filter(evs =>
      evs.some(e => e.event_type === 'inquiry_started') &&
      !evs.some(e => e.event_type === 'inquiry_submitted')
    )
    .reduce<Record<string, number>>((acc, evs) => {
      const charEvents = evs
        .filter(e => e.event_type === 'characteristic_changed' && typeof e.payload?.char_id === 'string')
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
      if (charEvents.length === 0) return acc
      const last = charEvents[0]
      const k = `${last.product_id}:::${last.payload.char_id as string}`
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  const topDropOff = Object.entries(dropOffFreq).sort((a, b) => b[1] - a[1]).slice(0, 6)

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-fade-in">
        <PageHeader title={t('Analytics')} description={t('Last 30 days of widget activity.')} />
        <div className="flex justify-center py-20"><Spinner /></div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title={t('Analytics')} description={t('Last 30 days of widget activity.')} />

      <div className="px-6 pt-2 space-y-6 pb-10">

        {/* ── Summary cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Eye}        label={t('Views')}           value={views.toLocaleString()}     sparkData={sparkViews}     color="#6366f1" />
          <StatCard icon={Send}       label={t('Inquiries')}       value={inquiries.toLocaleString()} sparkData={sparkInquiries} color="#10b981" />
          <StatCard icon={TrendingUp} label={t('Conversion')}      value={`${conversion}%`}           sub={t('views → inquiry')} />
          <StatCard icon={DollarSign} label={t('Avg quote price')} value={avgPrice}                   sub={prices.length > 0 ? `${prices.length} ${t('quotes')}` : undefined} />
        </div>

        {/* ── Per-product table ───────────────────────────────────────────── */}
        {productStats.length > 0 && (
          <div>
            <SectionHeading>{t('By product')}</SectionHeading>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t('Product')}</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t('Views')}</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t('Inquiries')}</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t('Conversion')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {productStats.map(ps => (
                    <tr key={ps.product_id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium truncate max-w-[200px]">{ps.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{ps.views.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{ps.inquiries.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{ps.conversion.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Advanced analytics ─────────────────────────────────────────── */}
        {isAdvanced ? (
          <div className="space-y-8">

            {/* Funnel */}
            <div>
              <SectionHeading>{t('Funnel')}</SectionHeading>
              <div className="flex items-end gap-4">
                {[
                  { label: t('Views'),     value: views,     color: 'bg-indigo-500' },
                  { label: t('Started'),   value: started,   color: 'bg-amber-500' },
                  { label: t('Submitted'), value: inquiries, color: 'bg-emerald-500' },
                ].map(step => {
                  const pct = views > 0 ? Math.round((step.value / views) * 100) : 0
                  return (
                    <div key={step.label} className="flex-1 text-center">
                      <div className="mx-auto mb-1.5 rounded" style={{ height: `${Math.max(pct, 4)}px`, maxHeight: '80px' }} />
                      <div className={`mx-auto rounded ${step.color}`} style={{ height: `${Math.max(pct, 4)}px`, maxHeight: '80px' }} />
                      <p className="text-xs font-medium mt-2">{step.value.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{step.label}</p>
                      {views > 0 && <p className="text-xs text-muted-foreground">{pct}%</p>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Most-interacted characteristics */}
            {topChars.length > 0 && (
              <div>
                <SectionHeading>{t('Most-interacted characteristics')}</SectionHeading>
                <div className="space-y-2">
                  {topChars.map(([key, cnt]) => {
                    const [productId, charId] = key.split(':::')
                    return (
                      <BarRow
                        key={key}
                        label={charNames[charId] ?? charId.slice(0, 8)}
                        sub={productNames[productId]}
                        count={cnt}
                        maxCount={topChars[0][1]}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* 1. Value frequency */}
            {topValues.length > 0 && (
              <div>
                <SectionHeading>{t('Most selected values')}</SectionHeading>
                <div className="space-y-2">
                  {topValues.map(([key, cnt]) => {
                    const [productId, charId, valueId] = key.split(':::')
                    const charName  = charNames[charId]   ?? charId.slice(0, 8)
                    const valueName = valueNames[valueId] ?? valueId.slice(0, 8)
                    const productName = productNames[productId] ?? ''
                    return (
                      <BarRow
                        key={key}
                        label={`${charName}: ${valueName}`}
                        sub={productName}
                        count={cnt}
                        maxCount={topValues[0][1]}
                        color="bg-violet-500"
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* 2. Price distribution */}
            {priceBuckets.length > 0 && (
              <div>
                <SectionHeading>{t('Price distribution')}</SectionHeading>
                <div className="flex items-end gap-2 h-24">
                  {(() => {
                    const maxCount = Math.max(...priceBuckets.map(b => b.count), 1)
                    return priceBuckets.map(bucket => (
                      <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs tabular-nums text-muted-foreground">{bucket.count || ''}</span>
                        <div
                          className="w-full rounded-t bg-emerald-500"
                          style={{ height: `${Math.max((bucket.count / maxCount) * 60, bucket.count > 0 ? 4 : 0)}px` }}
                        />
                        <span className="text-[10px] text-muted-foreground text-center leading-tight w-full truncate">{bucket.label}</span>
                      </div>
                    ))
                  })()}
                </div>
              </div>
            )}

            {/* 3. Drop-off by characteristic */}
            {topDropOff.length > 0 && (
              <div>
                <SectionHeading>{t('Drop-off — last characteristic before abandonment')}</SectionHeading>
                <div className="space-y-2">
                  {topDropOff.map(([key, cnt]) => {
                    const [productId, charId] = key.split(':::')
                    return (
                      <BarRow
                        key={key}
                        label={charNames[charId] ?? charId.slice(0, 8)}
                        sub={productNames[productId]}
                        count={cnt}
                        maxCount={topDropOff[0][1]}
                        color="bg-rose-500"
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* 5. Inquiry → quotation conversion */}
            {(quotConversion.total > 0 || inquiries > 0) && (
              <div>
                <SectionHeading>{t('Inquiry → quotation pipeline')}</SectionHeading>
                <div className="flex items-stretch gap-px rounded-lg overflow-hidden border text-sm">
                  {[
                    {
                      icon: Send,
                      label: t('Widget inquiries'),
                      value: inquiries,
                      pct: null,
                      color: 'bg-indigo-50 dark:bg-indigo-950/30',
                    },
                    {
                      icon: FileText,
                      label: t('Became quotations'),
                      value: quotConversion.fromWidget,
                      pct: inquiries > 0 ? Math.round((quotConversion.fromWidget / inquiries) * 100) : 0,
                      color: 'bg-amber-50 dark:bg-amber-950/30',
                    },
                    {
                      icon: TrendingUp,
                      label: t('Accepted'),
                      value: quotConversion.accepted,
                      pct: quotConversion.fromWidget > 0 ? Math.round((quotConversion.accepted / quotConversion.fromWidget) * 100) : 0,
                      color: 'bg-emerald-50 dark:bg-emerald-950/30',
                    },
                  ].map(({ icon: Icon, label, value, pct, color }) => (
                    <div key={label} className={`flex-1 px-4 py-3 ${color}`}>
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-xs">{label}</span>
                      </div>
                      <p className="text-xl font-bold tabular-nums">{value.toLocaleString()}</p>
                      {pct !== null && (
                        <p className="text-xs text-muted-foreground mt-0.5">{pct}%</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        ) : (
          <AdvancedGate />
        )}

        {events.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center gap-2">
            <BarChart2 className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">{t('No data yet')}</p>
            <p className="text-xs text-muted-foreground max-w-xs">{t('Analytics appear once your widget is embedded and visitors start interacting.')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
