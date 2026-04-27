import { useEffect, useState } from 'react'
import { BarChart2, Eye, Send, TrendingUp, DollarSign, Lock } from 'lucide-react'
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
}

interface DayStat { day: string; views: number; inquiries: number }

interface ProductStat {
  product_id: string
  name: string
  views: number
  inquiries: number
  conversion: number
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

  const [loading, setLoading]         = useState(true)
  const [events, setEvents]           = useState<EventRow[]>([])
  const [productNames, setProductNames] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!tenant) return

    const since = new Date()
    since.setDate(since.getDate() - 30)

    Promise.all([
      supabase
        .from('widget_events')
        .select('event_type, payload, created_at, product_id')
        .eq('tenant_id', tenant.id)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true })
        .limit(10000),
      supabase
        .from('products')
        .select('id, name')
        .eq('tenant_id', tenant.id)
        .eq('is_template', false),
    ]).then(([evRes, prRes]) => {
      setEvents((evRes.data ?? []) as EventRow[])
      const names: Record<string, string> = {}
      for (const p of (prRes.data ?? []) as { id: string; name: string }[]) names[p.id] = p.name
      setProductNames(names)
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
    if (e.event_type === 'view')               dayMap[k].views++
    if (e.event_type === 'inquiry_submitted')  dayMap[k].inquiries++
  }
  const days  = Object.values(dayMap)
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

  // Advanced: funnel + characteristic frequency
  const started    = events.filter(e => e.event_type === 'inquiry_started').length
  const charFreq   = events
    .filter(e => e.event_type === 'characteristic_changed' && typeof e.payload?.char_id === 'string')
    .reduce<Record<string, number>>((acc, e) => {
      const k = e.payload.char_id as string
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  const topChars = Object.entries(charFreq).sort((a, b) => b[1] - a[1]).slice(0, 5)

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
          <StatCard icon={Eye}        label={t('Views')}          value={views.toLocaleString()}      sparkData={sparkViews}     color="#6366f1" />
          <StatCard icon={Send}       label={t('Inquiries')}      value={inquiries.toLocaleString()}  sparkData={sparkInquiries} color="#10b981" />
          <StatCard icon={TrendingUp} label={t('Conversion')}     value={`${conversion}%`}            sub={t('views → inquiry')} />
          <StatCard icon={DollarSign} label={t('Avg quote price')} value={avgPrice}                   sub={prices.length > 0 ? `${prices.length} ${t('quotes')}` : undefined} />
        </div>

        {/* ── Per-product table ───────────────────────────────────────────── */}
        {productStats.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-3">{t('By product')}</h2>
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
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold mb-3">{t('Funnel')}</h2>
              <div className="flex items-end gap-4">
                {[
                  { label: t('Views'),      value: views,     color: 'bg-indigo-500' },
                  { label: t('Started'),    value: started,   color: 'bg-amber-500' },
                  { label: t('Submitted'),  value: inquiries, color: 'bg-emerald-500' },
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

            {topChars.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold mb-3">{t('Most-interacted characteristics')}</h2>
                <div className="space-y-2">
                  {topChars.map(([charId, cnt]) => {
                    const maxCnt = topChars[0][1]
                    return (
                      <div key={charId} className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-foreground w-20 truncate">{charId.slice(0, 8)}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(cnt / maxCnt) * 100}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{cnt}</span>
                      </div>
                    )
                  })}
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
