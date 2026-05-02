import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ──────────────────────────────────────────────────────────────────

interface ConfigLineItem {
  characteristic_name: string
  value_label: string
  price_modifier: number
}

interface InquiryRow {
  id: string
  tenant_id: string
  product_id: string
  customer_name: string
  customer_email: string
  message: string | null
  configuration: ConfigLineItem[]
  total_price: number | null
  currency: string
  created_at: string
}

interface ProductRow { name: string }
interface TenantRow  { name: string; notification_email: string | null }
interface ProfileRow { id: string }    // auth.users id
interface UserRow    { email: string } // from auth.users

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let inquiry_id: string
  try {
    const body = await req.json()
    inquiry_id = body.inquiry_id
    if (!inquiry_id) throw new Error('missing inquiry_id')
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendApiKey    = Deno.env.get('RESEND_API_KEY')!
  const fromEmail       = Deno.env.get('NOTIFY_FROM_EMAIL') ?? 'notifications@konfigurator.app'

  if (!resendApiKey) {
    console.error('notify-inquiry: RESEND_API_KEY not set')
    return new Response('Email provider not configured', { status: 500 })
  }

  // Service role client — bypasses RLS to read all tenant data
  const sb = createClient(supabaseUrl, serviceRoleKey)

  try {
    // ── 1. Fetch inquiry ────────────────────────────────────────────────────
    const { data: inquiry, error: inqErr } = await sb
      .from('inquiries')
      .select('id, tenant_id, product_id, customer_name, customer_email, message, configuration, total_price, currency, created_at')
      .eq('id', inquiry_id)
      .single()

    if (inqErr || !inquiry) {
      console.error('notify-inquiry: inquiry not found', inqErr)
      return new Response('Inquiry not found', { status: 404 })
    }

    const inq = inquiry as InquiryRow

    // ── 2. Fetch product name ───────────────────────────────────────────────
    const { data: product } = await sb
      .from('products')
      .select('name')
      .eq('id', inq.product_id)
      .single()

    const productName = (product as ProductRow | null)?.name ?? 'Unknown product'

    // ── 3. Resolve notification email ───────────────────────────────────────
    // Priority: tenant.notification_email → admin user's auth email
    const { data: tenant } = await sb
      .from('tenants')
      .select('name, notification_email')
      .eq('id', inq.tenant_id)
      .single()

    const tenantRow = tenant as TenantRow | null
    let toEmail = tenantRow?.notification_email ?? null

    if (!toEmail) {
      // Fall back to the email of the first admin profile for this tenant
      const { data: profile } = await sb
        .from('profiles')
        .select('id')
        .eq('tenant_id', inq.tenant_id)
        .eq('role', 'admin')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (profile) {
        const { data: { user } } = await sb.auth.admin.getUserById((profile as ProfileRow).id)
        toEmail = (user as UserRow | null)?.email ?? null
      }
    }

    if (!toEmail) {
      console.error('notify-inquiry: no notification email found for tenant', inq.tenant_id)
      return new Response('No recipient email configured', { status: 422 })
    }

    // ── 4. Build and send email ─────────────────────────────────────────────
    const html = buildEmailHtml({
      tenantName:    tenantRow?.name ?? 'Your store',
      productName,
      inquiry:       inq,
    })

    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    fromEmail,
        to:      [toEmail],
        subject: `New inquiry: ${productName} from ${inq.customer_name}`,
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('notify-inquiry: Resend error', res.status, body)
      return new Response('Email send failed', { status: 502 })
    }

    console.log(`notify-inquiry: sent for inquiry ${inquiry_id} to ${toEmail}`)

    // Fire-and-forget webhook delivery — don't block the response on this
    fetch(`${supabaseUrl}/functions/v1/deliver-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        event:     'inquiry.created',
        tenant_id: inq.tenant_id,
        payload: {
          inquiry_id:     inq.id,
          customer_name:  inq.customer_name,
          customer_email: inq.customer_email,
          product_name:   productName,
          product_id:     inq.product_id,
          total_price:    inq.total_price,
          currency:       inq.currency,
          configuration:  inq.configuration,
          created_at:     inq.created_at,
        },
      }),
    }).catch(err => console.warn('notify-inquiry: deliver-webhook call failed', err))

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('notify-inquiry: unexpected error', err)
    return new Response('Internal error', { status: 500 })
  }
})

// ── Email template ─────────────────────────────────────────────────────────

function buildEmailHtml({
  tenantName,
  productName,
  inquiry,
}: {
  tenantName: string
  productName: string
  inquiry: InquiryRow
}): string {
  const config = Array.isArray(inquiry.configuration) ? inquiry.configuration : []

  const configRows = config.map(item => `
    <tr>
      <td style="padding:6px 12px;color:#555;font-size:14px;">${esc(item.characteristic_name)}</td>
      <td style="padding:6px 12px;font-size:14px;">${esc(item.value_label)}</td>
      <td style="padding:6px 12px;font-size:14px;text-align:right;color:#555;">
        ${item.price_modifier !== 0
          ? (item.price_modifier > 0 ? '+' : '') + item.price_modifier.toFixed(2)
          : '—'}
      </td>
    </tr>`).join('')

  const priceRow = inquiry.total_price != null ? `
    <tr style="border-top:2px solid #e5e7eb;">
      <td colspan="2" style="padding:10px 12px;font-weight:600;font-size:14px;">Total</td>
      <td style="padding:10px 12px;font-weight:600;font-size:14px;text-align:right;">
        ${inquiry.total_price.toFixed(2)} ${esc(inquiry.currency)}
      </td>
    </tr>` : ''

  const messageBlock = inquiry.message ? `
    <div style="margin-top:24px;">
      <p style="margin:0 0 8px;font-weight:600;font-size:14px;">Message</p>
      <p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;">${esc(inquiry.message)}</p>
    </div>` : ''

  const date = new Date(inquiry.created_at).toLocaleString('en-GB', {
    dateStyle: 'medium', timeStyle: 'short',
  })

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:580px;margin:40px auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">

    <!-- Header -->
    <div style="padding:20px 28px;border-bottom:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">${esc(tenantName)}</p>
      <h1 style="margin:4px 0 0;font-size:18px;font-weight:600;color:#111;">New inquiry received</h1>
      <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">${date}</p>
    </div>

    <div style="padding:24px 28px;">

      <!-- Product -->
      <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Product</p>
      <p style="margin:0 0 20px;font-size:16px;font-weight:600;color:#111;">${esc(productName)}</p>

      <!-- Configuration -->
      ${config.length > 0 ? `
      <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Configuration</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:20px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500;">Option</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:500;">Selected</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:500;">Modifier</th>
          </tr>
        </thead>
        <tbody>${configRows}</tbody>
        ${priceRow ? `<tfoot>${priceRow}</tfoot>` : ''}
      </table>` : ''}

      <!-- Customer -->
      <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Customer</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
        <tr>
          <td style="padding:4px 0;font-size:14px;color:#555;width:80px;">Name</td>
          <td style="padding:4px 0;font-size:14px;">${esc(inquiry.customer_name)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:14px;color:#555;">Email</td>
          <td style="padding:4px 0;font-size:14px;">
            <a href="mailto:${esc(inquiry.customer_email)}" style="color:#2563eb;">${esc(inquiry.customer_email)}</a>
          </td>
        </tr>
      </table>

      ${messageBlock}
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;border-top:1px solid #e5e7eb;background:#f9fafb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Sent by Konfigurator &mdash; reply directly to the customer at
        <a href="mailto:${esc(inquiry.customer_email)}" style="color:#6b7280;">${esc(inquiry.customer_email)}</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
