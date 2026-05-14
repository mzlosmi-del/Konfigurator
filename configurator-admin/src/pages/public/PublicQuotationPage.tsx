import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// Anon client for the public /q/:token route. No session is ever persisted
// here, but we still give it a distinct storageKey so it doesn't share the
// admin app's GoTrueClient storage and trigger the "multiple GoTrueClient
// instances" warning when both modules are loaded into the same bundle.
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:     false,
    autoRefreshToken:   false,
    detectSessionInUrl: false,
    storageKey:         'sb-anon-public-quotation',
  },
})

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
  lang:                'en' | 'sr'
}

interface Tenant {
  name:                            string
  plan:                            string
  logo_url:                        string | null
  favicon_url:                     string | null
  public_page_title:               string | null
  quotation_accept_message_i18n:   Record<string, unknown> | null
  quotation_reject_message_i18n:   Record<string, unknown> | null
}

type View =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'expired',   quotation: Quotation, tenant: Tenant | null }
  | { kind: 'responded', quotation: Quotation, tenant: Tenant | null }
  | { kind: 'active',    quotation: Quotation, tenant: Tenant | null }

const ACCEPT_STATUSES = new Set(['accepted_no_changes', 'accepted_with_changes'])

// ── i18n ──────────────────────────────────────────────────────────────────

type Lang = 'en' | 'sr'

const PAGE_COPY: Record<Lang, {
  notFoundTitle:       string
  notFoundMsg:         string
  expiredBanner:       string
  expiredMsg:          (date: string, tenant: string) => string
  activeMsg:           (name: string, validUntil: string | null) => string
  customer:            string
  subtotal:            string
  total:               string
  validUntil:          string
  downloadPdf:         string
  accept:              string
  reject:              string
  acceptedBanner:      string
  rejectedBanner:      string
  acceptedThanks:      (date: string) => string
  rejectedThanks:      (date: string) => string
  confirmAcceptTitle:  (ref: string) => string
  confirmRejectTitle:  (ref: string) => string
  confirmAcceptBody:   string
  confirmRejectBody:   string
  cancel:              string
  submitting:          string
}> = {
  en: {
    notFoundTitle:       'Quote not found',
    notFoundMsg:         'This link may have expired or has already been replaced.',
    expiredBanner:       'Quote expired',
    expiredMsg:          (date, tenant) => `This quote was valid until ${date} and can no longer be confirmed online. Reach out to ${tenant} for an updated offer.`,
    activeMsg:           (name, validUntil) => `Hi ${name}, please review your quote below${validUntil ? ` — valid until ${validUntil}` : ''}.`,
    customer:            'Customer',
    subtotal:            'Subtotal',
    total:               'Total',
    validUntil:          'Valid until',
    downloadPdf:         'Download PDF',
    accept:              'Accept',
    reject:              'Reject',
    acceptedBanner:      'Accepted',
    rejectedBanner:      'Rejected',
    acceptedThanks:      (date) => `Thank you — your acceptance was recorded on ${date}.`,
    rejectedThanks:      (date) => `Your rejection was recorded on ${date}.`,
    confirmAcceptTitle:  (ref) => `Accept ${ref}?`,
    confirmRejectTitle:  (ref) => `Reject ${ref}?`,
    confirmAcceptBody:   "We'll record your acceptance and notify the supplier. You can't undo this from the link.",
    confirmRejectBody:   "We'll record your rejection and notify the supplier. You can't undo this from the link.",
    cancel:              'Cancel',
    submitting:          'Submitting…',
  },
  sr: {
    notFoundTitle:       'Ponuda nije pronađena',
    notFoundMsg:         'Ovaj link je možda istekao ili je zamenjen novim.',
    expiredBanner:       'Ponuda je istekla',
    expiredMsg:          (date, tenant) => `Ova ponuda je važila do ${date} i više se ne može potvrditi online. Kontaktirajte ${tenant} za ažuriranu ponudu.`,
    activeMsg:           (name, validUntil) => `Pozdrav ${name}, molimo pregledajte vašu ponudu ispod${validUntil ? ` — važi do ${validUntil}` : ''}.`,
    customer:            'Kupac',
    subtotal:            'Međuzbir',
    total:               'Ukupno',
    validUntil:          'Važi do',
    downloadPdf:         'Preuzmi PDF',
    accept:              'Prihvati',
    reject:              'Odbij',
    acceptedBanner:      'Prihvaćeno',
    rejectedBanner:      'Odbijeno',
    acceptedThanks:      (date) => `Hvala — vaše prihvatanje je evidentirano ${date}.`,
    rejectedThanks:      (date) => `Vaše odbijanje je evidentirano ${date}.`,
    confirmAcceptTitle:  (ref) => `Prihvatite ${ref}?`,
    confirmRejectTitle:  (ref) => `Odbijete ${ref}?`,
    confirmAcceptBody:   'Evidentiraćemo vaše prihvatanje i obavestiti pošiljaoca. Ova radnja se ne može opozvati preko linka.',
    confirmRejectBody:   'Evidentiraćemo vaše odbijanje i obavestiti pošiljaoca. Ova radnja se ne može opozvati preko linka.',
    cancel:              'Otkaži',
    submitting:          'Slanje…',
  },
}

function fmtDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return ''
  const locale = lang === 'sr' ? 'sr-Latn-RS' : 'en-GB'
  return new Date(iso).toLocaleDateString(locale, { dateStyle: 'long' })
}

function readTenantMessage(map: Record<string, unknown> | null | undefined, lang: Lang): string | null {
  if (!map) return null
  const raw = (map as Record<string, unknown>)[lang]
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t.length > 0 ? t : null
}

// ── Page ──────────────────────────────────────────────────────────────────

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
        .select('id, tenant_id, reference_number, title, customer_name, customer_email, customer_company, status, currency, subtotal, total_price, valid_until, pdf_url, notes, public_token, responded_at, lang')
        .eq('public_token', token)
        .maybeSingle()

      if (cancelled) return
      if (!quotation) { setView({ kind: 'invalid' }); return }

      const tenantId = (quotation as Quotation).tenant_id
      const [{ data: tenantRow }, { data: textRows }] = await Promise.all([
        anonClient
          .from('tenants')
          .select('name, plan, logo_url, favicon_url, public_page_title')
          .eq('id', tenantId)
          .maybeSingle(),
        anonClient
          .from('tenant_texts')
          .select('slot, language, content')
          .eq('tenant_id', tenantId)
          .eq('level', 'tenant')
          .is('reference_id', null)
          .in('slot', ['quotation_accept_message', 'quotation_reject_message']),
      ])

      // Resolve the accept/reject message rows from the central texts table
      // into the legacy JSONB shape the renderer below already understands.
      const messageRows = (textRows ?? []) as { slot: string; language: string; content: string }[]
      const messagesForSlot = (slot: string): Record<string, string> => {
        const out: Record<string, string> = {}
        for (const r of messageRows) {
          if (r.slot === slot && r.content.trim()) out[r.language] = r.content
        }
        return out
      }
      const tenant: Tenant | null = tenantRow
        ? {
            ...(tenantRow as Tenant),
            quotation_accept_message_i18n: messagesForSlot('quotation_accept_message'),
            quotation_reject_message_i18n: messagesForSlot('quotation_reject_message'),
          }
        : null
      const q      = quotation as Quotation
      const expired = !!q.valid_until && new Date(q.valid_until) < new Date()
      const respondedTerminal = q.status !== 'sent' && q.status !== 'confirmed' && (
        ACCEPT_STATUSES.has(q.status) || q.status === 'rejected' || q.status === 'expired'
      )

      if (respondedTerminal) {
        setView({ kind: 'responded', quotation: q, tenant })
      } else if (expired) {
        setView({ kind: 'expired', quotation: q, tenant })
      } else if (q.status === 'sent') {
        setView({ kind: 'active', quotation: q, tenant })
        if (initialAction === 'accept' || initialAction === 'reject') {
          setConfirmAction(initialAction)
        }
      } else {
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
        if (res.status === 409 && body.status) {
          setView({
            kind:      'responded',
            quotation: { ...view.quotation, status: body.status, responded_at: body.responded_at ?? new Date().toISOString() },
            tenant:    view.tenant,
          })
          return
        }
        if (res.status === 410) {
          setView({ kind: 'expired', quotation: view.quotation, tenant: view.tenant })
          return
        }
        throw new Error(body?.error ?? `Request failed (${res.status})`)
      }
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
    // Fall back to English when we have no quotation to read lang from.
    const c = PAGE_COPY.en
    return (
      <Shell>
        <Card>
          <h1 style={H1}>{c.notFoundTitle}</h1>
          <p style={MUTED}>{c.notFoundMsg}</p>
        </Card>
      </Shell>
    )
  }

  const q    = view.quotation
  const ten  = view.tenant
  const lang: Lang = q.lang === 'sr' ? 'sr' : 'en'
  const c    = PAGE_COPY[lang]
  const cur  = q.currency || ''

  const headerEl = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      {ten?.logo_url
        ? <img src={ten.logo_url} alt={ten.name} style={{ maxHeight: 40, maxWidth: 160, objectFit: 'contain' }} />
        : <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase', color: '#111' }}>
            {ten?.name ?? c.notFoundTitle}
          </span>
      }
    </div>
  )

  if (view.kind === 'expired') {
    return (
      <Shell>
        {headerEl}
        <Card>
          <Banner color="#92400e" bg="#fef3c7">{c.expiredBanner}</Banner>
          <h1 style={H1}>{q.reference_number}</h1>
          {q.title && <p style={MUTED}>{q.title}</p>}
          <p style={MUTED}>{c.expiredMsg(fmtDate(q.valid_until, lang), ten?.name ?? '')}</p>
          <DownloadButton url={q.pdf_url} label={c.downloadPdf} />
        </Card>
      </Shell>
    )
  }

  if (view.kind === 'responded') {
    const accepted     = ACCEPT_STATUSES.has(q.status)
    const banner       = accepted
      ? { text: c.acceptedBanner, color: '#065f46', bg: '#d1fae5' }
      : { text: c.rejectedBanner, color: '#991b1b', bg: '#fee2e2' }
    const tenantMsg    = accepted
      ? readTenantMessage(ten?.quotation_accept_message_i18n, lang)
      : readTenantMessage(ten?.quotation_reject_message_i18n, lang)
    const defaultMsg   = accepted
      ? c.acceptedThanks(fmtDate(q.responded_at, lang))
      : c.rejectedThanks(fmtDate(q.responded_at, lang))

    return (
      <Shell>
        {headerEl}
        <Card>
          <Banner color={banner.color} bg={banner.bg}>{banner.text}</Banner>
          <h1 style={H1}>{q.reference_number}</h1>
          {q.title && <p style={MUTED}>{q.title}</p>}
          <p style={{ ...MUTED, whiteSpace: 'pre-line' }}>{tenantMsg ?? defaultMsg}</p>
          <Summary q={q} cur={cur} c={c} lang={lang} />
          <DownloadButton url={q.pdf_url} label={c.downloadPdf} />
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
        <p style={MUTED}>{c.activeMsg(q.customer_name, q.valid_until ? fmtDate(q.valid_until, lang) : null)}</p>
        <Summary q={q} cur={cur} c={c} lang={lang} />
        <DownloadButton url={q.pdf_url} label={c.downloadPdf} />
        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setConfirmAction('accept')}
            disabled={actionPending}
            style={{ ...BTN, background: '#059669', color: '#fff' }}
          >
            {c.accept}
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction('reject')}
            disabled={actionPending}
            style={{ ...BTN, background: '#dc2626', color: '#fff' }}
          >
            {c.reject}
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
          c={c}
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

function Summary({ q, cur, c, lang }: { q: Quotation; cur: string; c: typeof PAGE_COPY['en']; lang: Lang }) {
  return (
    <div style={{ marginTop: 20, borderTop: '1px solid #e5e7eb' }}>
      <Row label={c.customer} value={q.customer_company ? `${q.customer_name} · ${q.customer_company}` : q.customer_name} />
      <Row label={c.subtotal} value={`${q.subtotal.toFixed(2)} ${cur}`} />
      <Row label={c.total}    value={`${q.total_price.toFixed(2)} ${cur}`} bold />
      {q.valid_until && <Row label={c.validUntil} value={fmtDate(q.valid_until, lang)} />}
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

function DownloadButton({ url, label }: { url: string | null; label: string }) {
  if (!url) return null
  return (
    <div style={{ marginTop: 18 }}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...BTN, background: '#fff', color: '#111', border: '1px solid #d1d5db', display: 'inline-block' }}
      >
        {label}
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
  c:                typeof PAGE_COPY['en']
}) {
  const { action, loading, referenceNumber, onConfirm, onCancel, c } = props
  const isAccept = action === 'accept'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, maxWidth: 420, width: '100%' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          {isAccept ? c.confirmAcceptTitle(referenceNumber) : c.confirmRejectTitle(referenceNumber)}
        </h2>
        <p style={{ margin: '12px 0 0', fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
          {isAccept ? c.confirmAcceptBody : c.confirmRejectBody}
        </p>
        <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{ ...BTN, background: '#fff', color: '#111', border: '1px solid #d1d5db' }}
          >
            {c.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{ ...BTN, background: isAccept ? '#059669' : '#dc2626', color: '#fff' }}
          >
            {loading ? c.submitting : (isAccept ? c.accept : c.reject)}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

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
