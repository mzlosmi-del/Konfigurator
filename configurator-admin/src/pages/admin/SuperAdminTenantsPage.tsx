import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, AlertTriangle, Building2 } from 'lucide-react'
import { useAuthContext } from '@/components/auth/AuthContext'
import {
  fetchTenantOverview,
  setTenantPlan,
  isSuperAdminEmail,
  isoToDateInput,
  dateInputToIso,
  shiftDays,
  daysUntil,
  type TenantOverviewRow,
} from '@/lib/superAdmin'
import { planLabel, limitDisplay, type Plan, type PlanLimits } from '@/lib/planLimits'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'

const PLANS: Plan[] = ['free', 'starter', 'growth', 'scale']

const PLAN_VARIANT: Record<Plan, 'secondary' | 'default' | 'success' | 'warning'> = {
  free:    'secondary',
  starter: 'default',
  growth:  'success',
  scale:   'warning',
}

function StatusBadge({ tenant }: { tenant: TenantOverviewRow }) {
  const days = daysUntil(tenant.paid_until ?? tenant.current_period_end)
  if (tenant.subscription_status === 'past_due') {
    return <Badge variant="destructive">Past due</Badge>
  }
  if (tenant.subscription_status === 'canceled') {
    return <Badge variant="destructive">Canceled</Badge>
  }
  if (days === null) {
    return <Badge variant="secondary">No expiry</Badge>
  }
  if (days < 0)        return <Badge variant="destructive">Expired {-days}d ago</Badge>
  if (days <= 14)      return <Badge variant="warning">Expires in {days}d</Badge>
  return <Badge variant="success">{days}d left</Badge>
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function SuperAdminTenantsPage() {
  const { user, loading: authLoading } = useAuthContext()
  const navigate = useNavigate()
  const { toasts, toast, dismiss } = useToast()

  const [rows, setRows]       = useState<TenantOverviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [planFilter, setPlanFilter] = useState<Plan | 'all'>('all')
  const [expiringOnly, setExpiringOnly] = useState(false)
  const [editing, setEditing] = useState<TenantOverviewRow | null>(null)

  // Guard: only sales@configureout.com may view this page
  useEffect(() => {
    if (authLoading) return
    if (!isSuperAdminEmail(user?.email)) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, authLoading, navigate])

  async function load() {
    setLoading(true)
    try {
      const data = await fetchTenantOverview()
      setRows(data)
    } catch (e) {
      toast({
        title: 'Failed to load tenants',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isSuperAdminEmail(user?.email)) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email])

  const filtered = useMemo(() => {
    return rows.filter(t => {
      if (planFilter !== 'all' && t.plan !== planFilter) return false
      if (expiringOnly) {
        const d = daysUntil(t.paid_until ?? t.current_period_end)
        if (d === null || d > 30) return false
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const hay = `${t.name} ${t.slug ?? ''} ${t.admin_email ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, search, planFilter, expiringOnly])

  if (authLoading || !isSuperAdminEmail(user?.email)) {
    return <div className="flex justify-center py-16"><Spinner /></div>
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Super admin · Tenants"
        description={
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Cross-tenant plan, usage, and expiry management.
          </span>
        }
      />

      <div className="p-4 md:p-6 space-y-4">
        <Card>
          <CardContent className="p-3 md:p-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 min-w-[12rem]">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <Input
                placeholder="Name, slug, or admin email"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Plan</label>
              <Select
                value={planFilter}
                onChange={e => setPlanFilter(e.target.value as Plan | 'all')}
                className="w-36"
              >
                <option value="all">All plans</option>
                {PLANS.map(p => <option key={p} value={p}>{planLabel(p)}</option>)}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm select-none cursor-pointer pb-1.5">
              <input
                type="checkbox"
                checked={expiringOnly}
                onChange={e => setExpiringOnly(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Expiring in 30d
            </label>
            <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-sm">No tenants match your filters.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tenant</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Plan</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Paid until</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Products</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Inquiries (mo)</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Members</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">AI (mo)</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(t => (
                    <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 min-w-[14rem]">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.admin_email ?? <span className="italic">no admin email</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={PLAN_VARIANT[t.plan]}>{planLabel(t.plan)}</Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {formatDate(t.paid_until ?? t.current_period_end)}
                      </td>
                      <td className="px-3 py-2"><StatusBadge tenant={t} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.products_count}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.inquiries_this_month}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.members_count}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.ai_setup_this_month}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => setEditing(t)}>Edit</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {filtered.length} tenant{filtered.length === 1 ? '' : 's'}
          {filtered.length !== rows.length && ` (of ${rows.length})`}
        </p>
      </div>

      {editing && (
        <TenantEditDialog
          tenant={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
          onError={msg => toast({ title: 'Save failed', description: msg, variant: 'destructive' })}
          onSuccess={() => toast({ title: 'Plan updated' })}
        />
      )}

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

interface TenantEditDialogProps {
  tenant:    TenantOverviewRow
  onClose:   () => void
  onSaved:   () => void
  onError:   (msg: string) => void
  onSuccess: () => void
}

function TenantEditDialog({ tenant, onClose, onSaved, onError, onSuccess }: TenantEditDialogProps) {
  const [plan, setPlan] = useState<Plan>(tenant.plan)
  const [paidUntil, setPaidUntil] = useState<string | null>(tenant.paid_until)
  const [saving, setSaving] = useState(false)
  const [limits, setLimits] = useState<PlanLimits | null>(null)

  // Load plan limits for the *selected* plan so usage gauges reflect the
  // target tier as the operator changes the dropdown.
  useEffect(() => {
    let alive = true
    supabase
      .from('plan_limits')
      .select('*')
      .eq('plan', plan)
      .single()
      .then(({ data }) => { if (alive && data) setLimits(data as PlanLimits) })
    return () => { alive = false }
  }, [plan])

  function bumpDays(n: number) {
    setPaidUntil(prev => shiftDays(prev, n))
  }

  async function save() {
    setSaving(true)
    try {
      await setTenantPlan(tenant.id, plan, paidUntil)
      onSuccess()
      onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const stripeManaged = !!tenant.stripe_subscription_id
  const days = daysUntil(paidUntil)

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tenant.name}</DialogTitle>
          <DialogDescription>
            {tenant.slug ? <span className="font-mono">{tenant.slug}</span> : null}
            {tenant.slug && ' · '}
            <span className="font-mono text-xs">{tenant.id}</span>
          </DialogDescription>
        </DialogHeader>

        {stripeManaged && (
          <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              This tenant is Stripe-managed (subscription{' '}
              <span className="font-mono">{tenant.stripe_subscription_id}</span>).
              Manual plan changes will be overwritten by the next Stripe webhook.
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Plan</label>
              <Select value={plan} onChange={e => setPlan(e.target.value as Plan)}>
                {PLANS.map(p => <option key={p} value={p}>{planLabel(p)}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Paid until</label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={isoToDateInput(paidUntil)}
                  onChange={e => setPaidUntil(dateInputToIso(e.target.value))}
                  className="flex-1"
                />
                {paidUntil && (
                  <Button variant="ghost" size="sm" onClick={() => setPaidUntil(null)}>Clear</Button>
                )}
              </div>
              {days !== null && (
                <p className="text-xs text-muted-foreground">
                  {days < 0 ? `Expired ${-days} day${days === -1 ? '' : 's'} ago` : `In ${days} day${days === 1 ? '' : 's'}`}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => bumpDays(30)}>+30 days</Button>
            <Button variant="outline" size="sm" onClick={() => bumpDays(90)}>+90 days</Button>
            <Button variant="outline" size="sm" onClick={() => bumpDays(365)}>+1 year</Button>
            <Button variant="outline" size="sm" onClick={() => bumpDays(-30)}>−30 days</Button>
          </div>

          <div className="rounded-md border bg-muted/20 p-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Current-period usage vs {planLabel(plan)} limits
            </div>
            <UsageLine label="Products"        used={tenant.products_count}       max={limits?.products_max} />
            <UsageLine label="Inquiries (mo)"  used={tenant.inquiries_this_month} max={limits?.inquiries_per_month} />
            <UsageLine label="Members"         used={tenant.members_count}        max={limits?.team_members_max} />
            <UsageLine label="AI setups (mo)"  used={tenant.ai_setup_this_month}  max={limits?.ai_setup_per_month} />
          </div>

          <div className="rounded-md border p-3 text-xs space-y-1">
            <div className="grid grid-cols-[10rem_1fr] gap-1">
              <span className="text-muted-foreground">Stripe customer</span>
              <span className="font-mono">{tenant.stripe_customer_id ?? '—'}</span>
              <span className="text-muted-foreground">Subscription</span>
              <span className="font-mono">{tenant.stripe_subscription_id ?? '—'}</span>
              <span className="text-muted-foreground">Status</span>
              <span>{tenant.subscription_status ?? '—'}</span>
              <span className="text-muted-foreground">Cancel at period end</span>
              <span>{tenant.cancel_at_period_end ? 'yes' : 'no'}</span>
              <span className="text-muted-foreground">Created</span>
              <span>{formatDate(tenant.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function UsageLine({ label, used, max }: { label: string; used: number; max: number | undefined }) {
  const maxN = max ?? 0
  const unlimited = max !== undefined && max < 0
  const pct = unlimited || max === undefined || maxN === 0 ? 0 : Math.min(100, (used / maxN) * 100)
  const over = !unlimited && max !== undefined && max >= 0 && used > max
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className={over ? 'text-destructive font-medium' : 'text-muted-foreground'}>
          {used} / {max === undefined ? '?' : limitDisplay(max)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={over ? 'h-full bg-destructive' : 'h-full bg-primary'}
          style={{ width: `${unlimited ? 6 : pct}%` }}
        />
      </div>
    </div>
  )
}
