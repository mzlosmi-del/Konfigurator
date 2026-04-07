# Configurator — Product Configurator SaaS

Multi-tenant product configurator SaaS. Admin panel + embeddable widget.

## Repository structure

```
configurator-admin/     React admin app (Vite + Tailwind + Supabase)
configurator-widget/    Embeddable widget (Preact + Vite IIFE bundle)
migrations/             Supabase SQL migrations (run in order)
```

---

## Quick start

### 1. Run migrations in Supabase

In your Supabase project → SQL Editor, run in order:

```
migrations/001_initial_schema.sql   ← full schema + RLS
migrations/002_seed_dev.sql         ← optional dev seed
migrations/003_verification.sql     ← verify (optional)
migrations/004_fix_tenants_rls.sql  ← required: fixes 406 on tenants table
```

### 2. Admin app

```bash
cd configurator-admin
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
# → http://localhost:5173
```

### 3. Widget (local dev)

```bash
cd configurator-widget
npm install
npm run dev
# → http://localhost:5174
# Edit index.html with your Supabase URL, anon key, product ID, tenant ID
```

### 4. Build & deploy widget

```bash
cd configurator-widget
npm run build
# Outputs: dist/widget.js (~62KB gzipped)
# Upload dist/widget.js to Cloudflare R2, Vercel, or any CDN
```

---

## Deploy admin to Vercel

1. Push to GitHub
2. Import `configurator-admin` folder in Vercel (set root directory)
3. Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. Optionally add `VITE_WIDGET_CDN_URL` for preview page support
5. Deploy

---

## Embed the widget

After deploying `widget.js` to a CDN, paste this on any product page:

```html
<div
  data-supabase-url="https://YOUR_PROJECT.supabase.co"
  data-supabase-anon-key="YOUR_ANON_KEY"
  data-product-id="PRODUCT_UUID"
  data-tenant-id="TENANT_UUID"
></div>
<script src="https://YOUR_CDN/widget.js" async></script>
```

The widget mounts into Shadow DOM — fully isolated from the host page styles.

---

## Environment variables

### configurator-admin

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `VITE_WIDGET_CDN_URL` | *(optional)* CDN URL for widget.js — enables preview page |

### configurator-widget

No env vars needed — all config is passed via HTML data attributes at runtime.

---

## What's implemented

- [x] Multi-tenant auth (register → tenant + profile in one RPC call)
- [x] Product CRUD with publish/unpublish
- [x] Characteristics library with reuse across products
- [x] Characteristic values with price modifiers (inline editor)
- [x] Configuration rules (hide/disable values)
- [x] Inquiry inbox with status filtering and live unread badge
- [x] Inquiry detail with config snapshot and email reply
- [x] Dashboard with real counts
- [x] Embeddable widget (Preact, Shadow DOM, ~62KB gzipped)
- [x] Widget: select/radio/swatch/toggle display types
- [x] Widget: live price calculation
- [x] Widget: rule evaluation (hide/disable values)
- [x] Widget: image swap on selection change
- [x] Widget: inquiry form with validation
- [x] Embed snippet generator in admin
- [x] Hosted preview page

## Coming next

- [ ] Visualization asset uploads (per option value) in admin
- [ ] PDF quote generation
- [ ] Stripe billing / plan limits
- [ ] Email notifications via Resend
