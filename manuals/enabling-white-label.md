# Enabling White-Label for a Tenant

A complete runbook for putting a tenant into white-label mode. White-label
covers three customer-facing surfaces:

1. **PDF footer** — the line at the bottom of every quotation PDF.
2. **Email from-address** — the address quotation, inquiry-notification,
   and team-invite emails come from.
3. **Public-page branding** — the favicon and browser tab title shown on
   `/p/:slug` (and the future `/q/:token`) pages.

A custom widget URL (CNAME-on-tenant-domain) is **not** part of this
runbook — it is intentionally deferred and requires CDN/edge infra
changes outside the application codebase.

The whole feature is gated by `plan_limits.white_label`, which is true
only on the **Scale** plan.

---

## 0. Pre-requisites (one-time SaaS-operator setup)

Do these once, before any tenant tries to use white-label.

### 0.1 Apply the database migrations

In Supabase → SQL Editor, run in order:

```sql
-- 062: server-side feature gates + apply_plan_downgrade/upgrade
-- (already required for general plan enforcement, but list it here for completeness)
\i migrations/062_feature_gate_triggers.sql

-- 063: tenants.pdf_footer
\i migrations/063_tenant_pdf_footer.sql

-- 064: tenants.email_from_address + email_from_verified + resend_domain_id
\i migrations/064_tenant_email_branding.sql

-- 065: tenants.favicon_url + public_page_title
\i migrations/065_tenant_public_branding.sql
```

(In the Supabase SQL editor you'll paste the contents of each file
rather than using `\i`.)

Verify the columns landed:

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'tenants'
   AND column_name IN ('pdf_footer','email_from_address','email_from_verified',
                       'resend_domain_id','favicon_url','public_page_title');
-- Expect 6 rows
```

### 0.2 Set the Resend API key on Edge Functions

The email-sending and domain-verification functions need
`RESEND_API_KEY` available as a secret. From the project root:

```bash
supabase secrets set RESEND_API_KEY=re_xxx_your_key
```

(or set it in Supabase Dashboard → Project Settings → Edge Functions →
Secrets.)

### 0.3 Deploy the Edge Functions

The `verify-email-domain` function is new. The four email-sending
functions (`notify-inquiry`, `generate-quote`, `generate-quotation`,
`send-invite`) were modified to call the shared `getFromAddress` helper
in `supabase/functions/_shared/emailSender.ts`.

**Recommended (CLI)** — bundles `_shared/` automatically:

```bash
cd <repo-root>
supabase functions deploy verify-email-domain
supabase functions deploy notify-inquiry
supabase functions deploy generate-quote
supabase functions deploy generate-quotation
supabase functions deploy send-invite
```

**Dashboard upload** — only `verify-email-domain` is bundle-safe for the
dashboard editor (it has no `_shared/` imports). The four email-sending
functions still import from `_shared/` and must be deployed via CLI, or
they will fail to bundle with `Module not found "_shared/...".`

### 0.4 Confirm `tenant_has_feature` exists

This SQL function was added in migration 029 and used by the new
triggers / Edge Functions:

```sql
SELECT public.tenant_has_feature('00000000-0000-0000-0000-000000000000'::uuid, 'white_label');
-- Returns: false (any random tenant id; the call should not error)
```

If this errors, re-run migration 029.

---

## 1. Move the tenant onto the Scale plan

White-label is only honoured for tenants on the Scale plan.

### Production: via Stripe

The tenant goes through the normal upgrade flow (Settings → Plan →
Upgrade to Scale). The `stripe-webhook` Edge Function fires
`apply_plan_upgrade(tenant_id)` automatically on `checkout.session.completed`.

### Manual / staging: direct DB update

```sql
UPDATE public.tenants SET plan = 'scale' WHERE id = '<tenant_uuid>';
SELECT public.apply_plan_upgrade('<tenant_uuid>'::uuid);
```

Confirm:

```sql
SELECT public.tenant_has_feature('<tenant_uuid>'::uuid, 'white_label');
-- Returns: true
```

> **Note**: If the tenant was previously on Scale, downgraded, then
> upgraded again, `apply_plan_upgrade` clears the stale `read_only`
> flags on visualization assets and re-runs `mark_over_limit_products`.
> Webhook endpoints are **not** auto-re-enabled — the tenant has to
> re-enable them manually in Settings.

---

## 2. The tenant configures each white-label surface

Once on Scale, the three Settings → Branding cards become editable.

### 2.1 PDF footer

1. Settings → Branding → **PDF footer**.
2. Type the override text (max 120 chars). Examples:
   - `Acme Corp · contact@acme.com`
   - `© 2026 Acme Corp. All rights reserved.`
3. Click **Save**.
4. Open any quotation, click *Generate PDF preview*, scroll to the
   bottom of the first page — the footer should read your custom text.
5. If empty, the default `Configureout` shows. Save an empty value to
   revert.

### 2.2 Email from-address

This is the most involved step — it requires DNS access on the
tenant's domain. Plan ~5–30 minutes including DNS propagation.

#### a) Register the domain

1. Settings → Branding → **Email from-address**.
2. Enter the **domain** (not the address — just `acme.com` or
   `mail.acme.com`).
3. Click **Register domain**.
4. The card now shows a DNS-records table. Three rows are typical:
   - `MX` — receive bounces (usually optional, but recommended).
   - `TXT` — SPF (`v=spf1 include:amazonses.com ~all` style).
   - `TXT` — DKIM (long key value).

#### b) Add the DNS records at the tenant's registrar

For each row in the table, copy `name`, `type`, and `value` into the
tenant's DNS provider:

| Provider | Where to add |
|---|---|
| Cloudflare | DNS → Records → Add record |
| GoDaddy    | My Products → DNS → Add |
| Namecheap  | Advanced DNS → Add new record |
| Route 53   | Hosted zones → Create record |

Tips:
- The `name` is usually `subdomain.acme.com` or `acme.com` (root). Most
  providers want only the subdomain part — strip the trailing `.acme.com`
  if the registrar appends it automatically.
- The `value` for DKIM is long — copy the **entire** string, do not add
  line breaks.
- TTL: 3600 (1 hour) is fine.

#### c) Re-check verification

1. Wait 1–5 minutes for DNS propagation (sometimes longer; use
   `dig TXT _dmarc.acme.com` from a terminal to spot-check).
2. Click **Re-check verification**.
3. When the green "Domain verified" banner appears, the from-address
   input becomes editable.

#### d) Set the from-address

1. Type the email you want emails to come from. It must be on the
   verified domain (Resend rejects mismatches):
   - ✅ `quotes@acme.com` if you verified `acme.com`
   - ✅ `quotes@mail.acme.com` if you verified `mail.acme.com`
   - ❌ `quotes@gmail.com` (different domain — will fall back to default)
2. Click **Save**.

#### e) Test

1. Submit a test inquiry from the embedded widget.
2. Check the inquiry notification email — `From:` should show the
   custom address.
3. Generate a quotation PDF and email it to a test customer. Same check.

### 2.3 Public-page branding

1. Settings → Branding → **Public page branding**.
2. Browser tab title — what shows in the `<title>` of `/p/:slug` and
   the future `/q/:token` pages. Example: `Configure your Acme product`.
3. Favicon URL — must be HTTPS. The image should be a 32×32 PNG, ICO,
   or SVG. Host it anywhere reachable; common choices:
   - `https://acme.com/favicon.ico`
   - `https://cdn.acme.com/favicon-32.png`
4. Click **Save**.
5. Open `/p/<one-of-tenant's-product-slugs>` in a private/incognito
   window — the tab favicon and title should be the tenant's.

---

## 3. Operator verification checklist

Run through this after a tenant has been provisioned, to confirm
everything is wired:

```sql
-- 1. Plan + feature flag
SELECT t.id, t.name, t.plan,
       public.tenant_has_feature(t.id, 'white_label') AS white_label_on,
       t.pdf_footer, t.email_from_address, t.email_from_verified,
       t.favicon_url, t.public_page_title
  FROM public.tenants t
 WHERE t.id = '<tenant_uuid>';

-- 2. Resend domain registered
SELECT id, name, plan, resend_domain_id, email_from_verified
  FROM public.tenants
 WHERE id = '<tenant_uuid>';

-- 3. No stale read-only flags from a prior downgrade
SELECT count(*) FROM public.visualization_assets
 WHERE tenant_id = '<tenant_uuid>' AND read_only = true;
-- Expect 0 if currently on scale and apply_plan_upgrade has run
```

Manual UI checks:
- [ ] Generated PDF footer reads the custom value
- [ ] Quotation email From shows the tenant's address
- [ ] Inquiry notification email From shows the tenant's address
- [ ] Team-invite email From shows the tenant's address
- [ ] Public preview page tab favicon + title are tenant's

---

## 4. Downgrade behaviour

If the tenant downgrades from Scale to a lower plan (Stripe webhook
fires `customer.subscription.updated` or `.deleted`), the
`apply_plan_downgrade` SQL helper runs automatically and:

- **PDF footer**: not touched (the column keeps its value, but
  `getFooterLabel()` checks the plan via the column being read into
  `TenantProfile`; since `tenant_has_feature` is the gate at the UI
  layer, the actual PDF render currently always uses the column).
  > **Caveat**: at the moment, the PDF render itself does *not*
  > re-check `tenant_has_feature('white_label')` — it just trusts the
  > column. If you want the PDF to immediately revert to "Configureout"
  > on downgrade, clear the column manually:
  > `UPDATE tenants SET pdf_footer = NULL WHERE id = '<tenant_uuid>';`
- **Email from-address**: `getFromAddress()` checks
  `tenant_has_feature(tenantId, 'white_label')` on every send, so
  emails revert to `NOTIFY_FROM_EMAIL` immediately on downgrade. The
  domain row in Resend is left in place; remove it from the Settings
  card if the tenant wants to free the slot.
- **Public-page branding**: both `PublicPreviewPage.tsx` and the
  `public-preview` Edge Function check the feature flag at render time.
  Pages revert to default Configureout title and favicon immediately.

The data is preserved across downgrades, so re-upgrading restores the
previous configuration without manual intervention.

---

## 5. Troubleshooting

### "Domain registration failed"

Common causes:
- `RESEND_API_KEY` not set on the Edge Function (operator setup §0.2).
- Tenant not on Scale plan (verify `tenant_has_feature(..., 'white_label')`).
- Domain already registered to another Resend account — Resend rejects
  duplicates. Either remove from the other account first or pick a
  subdomain (`mail.acme.com`).

### "Domain still pending verification" after 30+ minutes

- Run `dig TXT _dkim.<domain>` and `dig TXT <domain>` from a terminal.
  If the records don't show, DNS hasn't propagated yet (some registrars
  are slow).
- Check the Resend dashboard's domain page — it sometimes shows specific
  errors (e.g. "DKIM record incorrect").
- If the records look correct but Resend still says pending, click
  *Remove domain* and re-register — the second pass is sometimes faster.

### Emails still come from `notifications@konfigurator.app`

Check both conditions:

```sql
SELECT email_from_address, email_from_verified,
       public.tenant_has_feature(id, 'white_label') AS white_label_on
  FROM public.tenants
 WHERE id = '<tenant_uuid>';
```

All three of `email_from_address` (non-null), `email_from_verified`
(true), and `white_label_on` (true) must be true. If any is false, the
shared `getFromAddress` helper falls back to the default.

### `Failed to bundle the function ... Module not found "_shared/..."`

You're deploying via the dashboard editor, which doesn't include
sibling `_shared/` folders. Either:

1. Use the CLI: `supabase functions deploy <name>` (recommended).
2. Or, for new functions, write them self-contained without
   `_shared/` imports (this is what `verify-email-domain` does — it
   uses the SQL helper `tenant_has_feature` directly).

### `403 Plan limit exceeded — white_label`

The tenant is not on Scale. Check `tenants.plan`. If it should be
Scale but isn't, look at `tenants.subscription_status` and the latest
`processed_events` row to see what the most recent Stripe event did.

---

## 6. File reference

For developers extending or debugging this feature:

| Surface | DB column | Resolver | Consumer |
|---|---|---|---|
| PDF footer | `tenants.pdf_footer` | `getFooterLabel(tenant, default)` in `configurator-admin/src/lib/pdf/shared.ts` | All four templates: `templateModern.ts`, `templateClassic.ts`, `templateCompact.ts`, `templateBold.ts` |
| Email from-address | `tenants.email_from_address` + `email_from_verified` | `getFromAddress(sb, tenantId)` in `supabase/functions/_shared/emailSender.ts` | `notify-inquiry`, `generate-quote`, `generate-quotation`, `send-invite` |
| Public-page favicon + title | `tenants.favicon_url`, `tenants.public_page_title` | inline in render | `configurator-admin/src/pages/public/PublicPreviewPage.tsx` (SPA), `supabase/functions/public-preview/index.ts` (SSR) |

Migrations: `062_feature_gate_triggers.sql`, `063_tenant_pdf_footer.sql`,
`064_tenant_email_branding.sql`, `065_tenant_public_branding.sql`.
