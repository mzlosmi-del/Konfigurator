import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

interface Quotation {
  id:                  string
  tenant_id:           string
  reference_number:    string
  title:               string | null
  customer_name:       string
  customer_email:      string
  customer_company:    string | null
  status:              string
  currency:            string
  subtotal:            number
  total_price:         number
  valid_until:         string | null
  pdf_url:             string | null
  notes:               string | null
  public_token:        string
  responded_at:        string | null
}

interface Tenant {
  name:              string
  plan:              string
  logo_url:          string | null
  favicon_url:       string | null
  public_page_title: string | null
}

type View =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'expired',   quotation: Quotation, tenant: Tenant | null }
  | { kind: 'responded', quotation: Quotation, tenant: Tenant | null }
  | { kind: 'active',    quotation: Quotation, tenant: Tenant | null }

const ACCEPT_STATUSES = new Set(['accepted_no_changes', 'accepted_with_changes'])

export function PublicQuotationPage() {
  const { token }      = useParams<{ token: string }>()
  const [params]       = useSearchParams()
  const initialAction  = params.get('action')   // 'accept' | 'reject' | null
  const [view, setView]               = useState<View>({ kind: 'loading' })
  const [actionPending, setActionPending] = useState(false)
  const [confirmAction, setConfirmAction] = useState<null | 'accept' | 'reject'>(null)

  // ── Fetch on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setView({ kind: 'invalid' }); return }
    let cancelled = false

    ;(async () => {
      const { data: quotation } = await anonClient
        .from('quotations')
        .select('id, tenant_id, reference_number, title, customer_name, customer_email, customer_company, status, currency, subtotal, total_price, valid_until, pdf_url, notes, public_token, responded_at')
        .eq('public_token', token)
        .maybeSingle()

      if (cancelled) return
      if (!quotation) { setView({ kind: 'invalid' }); return }

      const { data: tenantRow } = await anonClient
        .from('tenants')
        .select('name, plan, logo_url, favicon_url, public_page_title')
        .eq('id', (quotation as Quotation).tenant_id)
        .maybeSingle()

      const tenant = (tenantRow as Tenant | null) ?? null
      const q      = quotation as Quotation
      const expired = !!q.valid_until && new Date(q.valid_until) < new Date()
      const respondedTerminal = q.status !== 'confirmed_sent' && (
        ACCEPT_STATUSES.has(q.status) || q.status === 'rejected' || q.status === 'expired'
      )

      if (respondedTerminal) {
        setView({ kind: 'responded', quotation: q, tenant })
      } else if (expired) {
        setView({ kind: 'expired', quotation: q, tenant })
      } else if (q.status === 'confirmed_sent') {
        setView({ kind: 'active', quotation: q, tenant })
        if (initialAction === 'accept' || initialAction === 'reject') {
          setConfirmAction(initialAction)
        }
      } else {
        // Statuses outside the terminal/active set fall through to "invalid".
        setView({ kind: 'invalid' })
      }
    })()

    return () => { cancelled = true }
  }, [token, initialAction])

  // ── Tenant favicon + tab title (white-label) ────────────────────────────
  useEffect(() => {
    const t = view.kind === 'active' || view.kind === 'expired' || view.kind === 'responded' ? view.tenant : null
    if (!t) return
    if (t.public_page_title) document.title = t.public_page_title
    if (t.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = t.favicon_url
    }
  }, [view])

  // ── Submit Accept / Reject ──────────────────────────────────────────────
  async function submitAction(action: 'accept' | 'reject') {
    if (view.kind !== 'active' || !token) return
    setActionPending(true)
    try {
      const res  = await fetch(`${SUPABASE_URL}/functions/v1/quotation-respond`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ token, action }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Already responded / expired — sync the view to the server state.
        if (res.status === 409 && body.status) {
          setView({ kind: 'responded', quotation: { ...view.quotation, status: body.status, responded_at: body.responded_at ?? new Date().toISOString() }, tenant: view.tenant })
          return
        }
        if (res.status === 410) {
          setView({ kind: 'expired', quotation: view.quotation, tenant: view.tenant })
          return
        }
        throw new Error(body?.error ?? `Request failed (${res.status})`)
      }
      // Success — flip to responded view with the new status.
      setView({
        kind:      'responded',
        quotation: { ...view.quotation, status: body.status, responded_at: body.responded_at },
        tenant:    view.tenant,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setActionPending(false)
      setConfirmAction(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (view.kind === 'loading') return null

  if (view.kind === 'invalid') {
    return (
      <Shell>
        <Card>
          <h1 style={H1}>Quote not found</h1>
          <p style={MUTED}>This link may have expired or has already been replaced.</p>
        </Card>
      </Shell>
    )
  }

  const q   = view.quotation
  const ten = view.tenant
  const cur = q.currency || ''

  const headerEl = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      {ten?.logo_url
        ? <img src={ten.logo_url} alt={ten.name} style={{ maxHeight: 40, maxWidth: 160, objectFit: 'contain' }} />
        : <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase', color: '#111' }}>
            {ten?.name ?? 'Quote'}
          </span>
      }
    </div>
  )

  if (view.kind === 'expired') {
    return (
      <Shell>
        {headerEl}
        <Card>
          <Banner color="#92400e" bg="#fef3c7">Quote expired</Banner>
          <h1 style={H1}>{q.reference_number}</h1>
          {q.title && <p style={MUTED}>{q.title}</p>}
          <p style={MUTED}>
            This quote was valid until <strong>{fmt(q.valid_until)}</strong> and can no longer be confirmed online.
            Reach out to {ten?.name ?? 'us'} for an updated offer.
          </p>
          <DownloadButton url={q.pdf_url} />
        </Card>
      </Shell>
    )
  }

  if (view.kind === 'responded') {
    const accepted = ACCEPT_STATUSES.has(q.status)
    const banner   = accepted
      ? { text: 'Accepted',  color: '#065f46', bg: '#d1fae5' }
      : { text: 'Rejected',  color: '#991b1b', bg: '#fee2e2' }
    return (
      <Shell>
        {headerEl}
        <Card>
          <Banner color={banner.color} bg={banner.bg}>{banner.text}</Banner>
          <h1 style={H1}>{q.reference_number}</h1>
          {q.title && <p style={MUTED}>{q.title}</p>}
          <p style={MUTED}>
            {accepted ? 'Thank you — your acceptance was recorded' : 'Your rejection was recorded'}
            {q.responded_at && <> on <strong>{fmt(q.responded_at)}</strong></>}.
          </p>
          <Summary q={q} cur={cur} />
          <DownloadButton url={q.pdf_url} />
        </Card>
      </Shell>
    )
  }

  // Active
  return (
    <Shell>
      {headerEl}
      <Card>
        <h1 style={H1}>{q.reference_number}</h1>
        {q.title && <p style={MUTED}>{q.title}</p>}
        <p style={MUTED}>
          Hi {q.customer_name}, please review your quote below
          {q.valid_until && <> — valid until <strong>{fmt(q.valid_until)}</strong></>}.
        </p>
        <Summary q={q} cur={cur} />
        <DownloadButton url={q.pdf_url} />
        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setConfirmAction('accept')}
            disabled={actionPending}
            style={{ ...BTN, background: '#059669', color: '#fff' }}
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction('reject')}
            disabled={actionPending}
            style={{ ...BTN, background: '#dc2626', color: '#fff' }}
          >
            Reject
          </button>
        </div>
      </Card>

      {confirmAction && (
        <ConfirmDialog
          action={confirmAction}
          loading={actionPending}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => submitAction(confirmAction)}
          referenceNumber={q.reference_number}
        />
      )}
    </Shell>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', color: '#111', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 48px' }}>
        {children}
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '28px 24px' }}>
      {children}
    </div>
  )
}

function Banner({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <div style={{ background: bg, color, fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', padding: '6px 10px', borderRadius: 4, display: 'inline-block', marginBottom: 12 }}>
      {children}
    </div>
  )
}

function Summary({ q, cur }: { q: Quotation; cur: string }) {
  return (
    <div style={{ marginTop: 20, borderTop: '1px solid #e5e7eb' }}>
      <Row label="Customer" value={q.customer_company ? `${q.customer_name} · ${q.customer_company}` : q.customer_name} />
      <Row label="Subtotal" value={`${q.subtotal.toFixed(2)} ${cur}`} />
      <Row label="Total"    value={`${q.total_price.toFixed(2)} ${cur}`} bold />
      {q.valid_until && <Row label="Valid until" value={fmt(q.valid_until)} />}
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color: '#111', fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  )
}

function DownloadButton({ url }: { url: string | null }) {
  if (!url) return null
  return (
    <div style={{ marginTop: 18 }}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...BTN, background: '#fff', color: '#111', border: '1px solid #d1d5db', display: 'inline-block' }}
      >
        Download PDF
      </a>
    </div>
  )
}

function ConfirmDialog(props: {
  action:           'accept' | 'reject'
  loading:          boolean
  referenceNumber:  string
  onConfirm:        () => void
  onCancel:         () => void
}) {
  const { action, loading, referenceNumber, onConfirm, onCancel } = props
  const isAccept = action === 'accept'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          {isAccept ? `Accept ${referenceNumber}?` : `Reject ${referenceNumber}?`}
        </h2>
        <p style={{ margin: '12px 0 0', fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
          {isAccept
            ? "We'll record your acceptance and notify the supplier. You can't undo this from the link."
            : "We'll record your rejection and notify the supplier. You can't undo this from the link."}
        </p>
        <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{ ...BTN, background: '#fff', color: '#111', border: '1px solid #d1d5db' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{ ...BTN, background: isAccept ? '#059669' : '#dc2626', color: '#fff' }}
          >
            {loading ? 'Submitting…' : (isAccept ? 'Accept' : 'Reject')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Styles + helpers ───────────────────────────────────────────────────────

const H1: React.CSSProperties = {
  fontSize:  20,
  fontWeight: 700,
  margin:    '0 0 8px',
  color:     '#111',
}
const MUTED: React.CSSProperties = {
  margin:   '0 0 8px',
  fontSize: 14,
  color:    '#6b7280',
  lineHeight: 1.5,
}
const BTN: React.CSSProperties = {
  display:        'inline-block',
  padding:        '10px 20px',
  borderRadius:   6,
  fontSize:       14,
  fontWeight:     600,
  cursor:         'pointer',
  border:         'none',
  textDecoration: 'none',
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'long' })
}
