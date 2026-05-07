# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dev Commands

### Admin panel (`configurator-admin/`)
```bash
npm run dev        # Vite dev server
npm run build      # tsc + vite build
npm run test       # vitest (jsdom)
npm run lint       # eslint
npx tsc --noEmit   # type-check without emitting
```

### Widget (`configurator-widget/`)
```bash
npm run dev    # Vite dev server
npm run build  # builds to dist/widget.js AND copies it to ../configurator-admin/public/widget.js
npm run test   # vitest
```

The widget build output (`configurator-admin/public/widget.js`) is committed to the repo so the admin panel can serve it without a separate build step.

## Architecture

### Overview
Multi-tenant SaaS product configurator. Three main pieces:
1. **`configurator-admin/`** — React + Tailwind admin panel (manages tenants, products, quotations, inquiries, settings)
2. **`configurator-widget/`** — Preact widget compiled to an IIFE bundle, embedded in customer-facing sites via a `<script>` tag and a `<div data-configurator-product-id="...">` element. It runs in a Shadow DOM for style isolation.
3. **`supabase/`** — PostgreSQL database, RLS policies, and 16 Edge Functions (Deno runtime)

### Multi-tenancy & RLS
Every data table has a `tenant_id uuid` column. All Supabase RLS policies gate access through `auth_tenant_id()`, a SQL function that resolves the current JWT's `tenant_id` claim. There are no application-level tenant filters — the DB enforces isolation automatically. When adding a new table, always add `tenant_id` + an RLS policy using `auth_tenant_id()`.

### Database types
`configurator-admin/src/types/database.ts` is hand-written (not generated). It must be updated manually whenever a migration adds or removes columns. Migrations are numbered sequentially as `migrations/NNN_description.sql`. There are no auto-generation scripts.

Key JSONB columns (types defined in `database.ts` around line 20–60):
- `quotations.line_items` → `QuotationLineItem[]` — each item has `product_id`, `quantity`, `unit_price`, `configuration: QuotationConfigItem[]`, `adjustments?: QuotationAdjustment[]`
- `quotations.adjustments` → `QuotationAdjustment[]` — quotation-level tax/discount/surcharge
- `inquiries.configuration` → `{ characteristic_name, value_label, price_modifier }[]`

### Quotation calculations (`configurator-admin/src/lib/quotations.ts`)
`calcTotal(base, adjustments)` applies adjustments sequentially (order matters — percent adjustments apply to the running total). `calcSubtotal(items)` sums line totals. The PDF and UI both import these helpers — do not duplicate the logic.

### PDF generation (`configurator-admin/src/lib/quotationPdf.ts`)
Uses `pdf-lib` with Helvetica/HelveticaBold (no custom font loading). Canvas is A4 (595 × 842 pt). Coordinate origin is bottom-left; `y` tracks the current drawing position from the top. Call `ensureSpace(page, n)` before rendering a block to trigger a page break if fewer than `n` points remain. The design is minimal: no filled colour rectangles — separators are thin rules, hierarchy is typographic.

### PDF preview dialog (`configurator-admin/src/pages/quotations/PdfLayoutDialog.tsx`)
`PdfLayoutDialog` is a two-panel visual preview dialog (not just a section list). Left panel: drag-to-reorder section controls + language toggle + Generate button. Right panel: live A4-shaped HTML approximation of the PDF showing actual quotation data. Fixed blocks (header, sender strip, bill-to, line items) are non-interactive. Configurable section cards (notes, terms, global/product text blocks) show their actual content and have an eye icon to toggle visibility directly in the preview.

`TenantProfile` must be pre-fetched before opening the dialog — in `QuotationDetailPage`, this happens inside `handleGeneratePdf` so it is ready by the time the dialog renders.

### Supabase Edge Functions (`supabase/functions/`)
16 functions covering: product config serving (for the widget), inquiry submission, quotation PDF email delivery, plan enforcement, Stripe webhooks, etc. Each function is a standalone Deno module. Shared code lives in `supabase/functions/_shared/`.

### Admin routing (`configurator-admin/src/App.tsx`)
React Router v6. Top-level routes: `/login`, `/register`, and a layout wrapper for authenticated routes. Key page paths: `/products`, `/quotations`, `/inquiries`, `/settings`, `/analytics`, `/plan`, `/admin/audit-log`.

### Per-role authorization system (migration 048)
`role_permissions` table stores a per-tenant, per-role permission matrix. Roles: `admin`, `member`, `viewer`. Levels: `none`, `view`, `edit`. Functionalities: `dashboard`, `products`, `pricing`, `library`, `texts`, `inquiries`, `quotations`, `analytics`, `embed`, `settings`.

- DB helpers: `auth_role()` returns current user's role; `auth_can(functionality, level)` returns boolean (admin always true, missing row = false/deny).
- React hooks in `configurator-admin/src/hooks/usePermission.ts`: `usePermission(f)` → `PermLevel`, `useCanView(f)` → boolean, `useCanEdit(f)` → boolean.
- `AuthContext` loads `permissions` map on login and makes it available throughout the app.
- RLS on `products`, `characteristics`, `characteristic_values`, `inquiries`, `quotations` enforces these levels — not just UI gates.
- New tenants get seeded defaults: `member` → `edit` everywhere, `viewer` → `view` everywhere (done inside `handle_new_user()`).

### Audit log system (migration 060)
`audit_log` table: one row per save/delete, stores a JSONB diff of only changed fields with human-readable keys. 90-day retention via pg_cron (falls back gracefully if pg_cron unavailable).

- `configurator-admin/src/lib/auditLog.ts`: `logChange(opts)` — inserts a row, swallows errors so audit never breaks a save. `computeDiff(before, after, labelMap)` — compares two snapshots, returns only changed fields keyed by label. `fetchAuditLog(filter)` — paginated fetch with filters.
- `configurator-admin/src/lib/auditLabels.ts`: entity-specific label maps that control which fields appear in diffs.
- Components: `AuditHistory` (inline panel, shown on product/quotation detail pages), `AuditDiffTable` (renders the diff JSONB as a before/after table).
- `AuditLogPage` at `/admin/audit-log` — global log visible to admins only, with entity-type and date filters.
- Currently wired up on: products, quotations, quotation line items, characteristics, characteristic values, settings, texts, pricing formulas.

**IMPORTANT: Migration 060 (`migrations/060_audit_log.sql`) has NOT yet been run in Supabase. Run it in the SQL editor before the audit log feature will work in production.**

### Widget theme per product (migration 059)
`products.widget_theme` column (text, default `'cloud'`). Persisted from the Embed panel (`EmbedPanel.tsx`) and read by the widget embed snippet to apply the correct theme automatically. Available themes are defined in the widget as `ThemeId`.

### Quotation lifecycle
Quotations have a status progression: `draft` → `preview` → `confirmed` → `locked`. Transitions are enforced in the UI. A locked quotation is read-only. Duplicate action available on any quotation to create a draft copy.

### Analytics page
`AnalyticsPage.tsx` has four advanced sections beyond basic counts: characteristic-value breakdown, inquiry-to-quotation conversion funnel, revenue over time, and top products by inquiry volume. All sections are tenant-scoped.

### Supabase client
Single typed client in `configurator-admin/src/lib/supabase.ts` using env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The widget uses its own client (same env vars, passed via data attributes on the embed `<div>`).

## Key Conventions

- **Migrations**: name as `migrations/NNN_short_description.sql`, increment the number. Run manually in the Supabase SQL editor — there is no automated migration runner.
- **Type sync**: after every migration, update the relevant Row/Insert/Update interfaces in `database.ts`.
- **JSONB interfaces**: JSONB column types are defined in the `// JSONB interfaces` section near the top of `database.ts`. Existing rows without new optional keys are valid (treated as `undefined`/`null` by the app).
- **Widget build**: always run `npm run build` in `configurator-widget/` after widget changes — the copied `widget.js` in `configurator-admin/public/` is what actually gets served.
- **No auto-formatting config**: the project uses ESLint but no Prettier. Match surrounding code style.
