# Configurator Admin

Multi-tenant product configurator SaaS — admin panel.

Built with React + Vite + Supabase. Deployable to Vercel in minutes.

---

## Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, shadcn-style components
- **Backend:** Supabase (Postgres + Auth + RLS + Realtime)
- **Hosting:** Vercel (SPA with rewrite rule)

---

## Project structure

```
configurator-admin/   ← React admin app
  src/
    components/       ← UI primitives, layout, auth
    hooks/            ← useAuth, useToast, useInquiryCounts
    lib/              ← supabase client, products queries, inquiries queries
    pages/            ← auth, dashboard, products, inquiries, settings
    types/            ← database.ts (typed schema)

migrations/
  001_initial_schema.sql   ← full schema + RLS policies
  002_seed_dev.sql         ← dev seed (Firma X tenant)
  003_verification.sql     ← verification queries
```

---

## Setup

### 1. Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run migrations in order:
   - `migrations/001_initial_schema.sql`
   - `migrations/002_seed_dev.sql` *(optional, dev only)*
3. Run `create_tenant_for_user` function (already included in migration)
4. In **Database → Replication**, enable the `inquiries` table for realtime

### 2. Local development

```bash
cd configurator-admin
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project settings
npm install
npm run dev
```

### 3. Deploy to Vercel

1. Push this repo to GitHub
2. Import the `configurator-admin` folder in Vercel (set root directory to `configurator-admin`)
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

---

## Auth flow

Registration creates both the Supabase auth user and the tenant+profile via the `create_tenant_for_user` RPC function. No auth hooks or triggers required — works on Supabase free plan.

---

## Environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon (public) key |

Never commit `.env.local`. The `.gitignore` already excludes it.

---

## What's implemented (Phase 1–3)

- [x] Multi-tenant auth (register → tenant + profile provisioned)
- [x] Product CRUD (create, edit, publish/unpublish, delete)
- [x] Characteristics library (create, reuse across products)
- [x] Characteristic values with price modifiers (inline add/edit/delete)
- [x] Inquiry inbox with status filtering
- [x] Inquiry detail with config snapshot and email reply
- [x] Live unread badge in sidebar (Supabase Realtime)
- [x] Dashboard with real counts and recent inquiries

## Coming next (Phase 4)

- [ ] Embeddable configurator widget
- [ ] Visualization assets (image upload per option value)
- [ ] Configuration rules (hide/disable values)
- [ ] Embed snippet generator in admin
