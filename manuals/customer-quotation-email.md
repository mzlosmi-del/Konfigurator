# Sending a Quotation to the Customer (Email + Accept/Reject)

The admin can email a confirmed quotation to the customer with the PDF
attached and three call-to-action buttons in the email body:

- **View online** — opens the public read-only page at `/q/:token`.
- **Accept** — opens the same page with the accept dialog pre-opened.
- **Reject** — same, with the reject dialog pre-opened.

The customer must click the button on the public page to actually
record the response (the email link doesn't auto-action — that protects
against bots/preview-fetchers triggering accidental responses).

The response is recorded once: the second click sees the new status and
shows the recorded outcome instead of the action buttons.

---

## 0. One-time operator setup

### 0.1 Apply migration 067

In Supabase → SQL Editor, paste and run:

```
migrations/067_quotation_public_response.sql
```

Verify the new columns and trigger:

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'quotations'
   AND column_name IN ('public_token','responded_at','responded_ip','responded_user_agent');
-- Expect 4 rows

SELECT public_token FROM public.quotations
 WHERE status = 'confirmed_sent' LIMIT 5;
-- Expect non-null values (the migration backfills tokens for existing rows)
```

### 0.2 Set the PUBLIC_APP_URL secret

The email links are built from this. Without it, links default to
`https://app.configureout.com`.

```bash
supabase secrets set PUBLIC_APP_URL=https://app.configureout.com
# or via Dashboard → Project Settings → Edge Functions → Secrets
```

`RESEND_API_KEY` and `NOTIFY_FROM_EMAIL` must also be set. They were
already configured for `notify-inquiry` / `send-invite`, so usually
nothing to do here.

### 0.3 Deploy the two Edge Functions

Both are self-contained (no `_shared/` imports), so dashboard upload
works:

```bash
supabase functions deploy send-quotation-email
supabase functions deploy quotation-respond
```

Or, in the Supabase Dashboard: Edge Functions → New Function → paste
the contents of `supabase/functions/<name>/index.ts`.

`quotation-respond` must be **publicly invokable** (no JWT). In the
dashboard this is the "Verify JWT" toggle on the function — turn it
**off**. The `send-quotation-email` function keeps JWT verification on.

---

## 1. Day-to-day flow

1. Build a quotation in `/quotations/new`. Fill customer name + email
   (the email is required for the send step).
2. Click **Confirm & Generate PDF**. This:
   - Generates the PDF and uploads it to Storage.
   - Flips status to `confirmed_sent`.
   - The DB trigger `trg_assign_quotation_token` populates
     `public_token` with a 32-byte hex string.
3. Click **Send to customer** (new button on the detail page, visible
   only when status is `confirmed_sent` and a customer email is
   present). The button text becomes **Resend to customer** after the
   first send.
4. The customer receives an email containing:
   - PDF copy attached.
   - **View online** / **Accept** / **Reject** buttons that link to
     `https://<your-app>/q/<public_token>`.
5. The customer clicks one button. The public page opens with the
   matching confirm dialog already up. They click confirm.
6. `quotation-respond` flips status to `accepted_no_changes` or
   `rejected`, records timestamp + IP + user-agent on the quotation,
   and writes one `audit_log` row attributed to
   `"<customer_name> (customer)"`.
7. The public page swaps to the terminal-state card showing
   "Accepted on …" or "Rejected on …".
8. Clicking the email button again later just shows the same terminal
   state — clicks after the first are idempotent no-ops.

---

## 2. Validity window

The `quotation.valid_until` column is the source of truth. If it is
set and `valid_until < now()` at the moment the customer clicks, the
endpoint returns 410 Gone and the public page shows an "expired" card
instead of the action buttons. No status change is recorded.

If `valid_until` is null, the link does not auto-expire — accept/reject
remains possible until you change the status manually.

The 32-byte token has no separate expiry column (kept simple). Token
secrecy plus the `valid_until` window is the access policy.

---

## 3. What the customer sees

```
/q/<token>?action=accept|reject|<none>

  ┌────────────────────────────────────────────────────────────┐
  │  [TENANT LOGO or NAME]                                     │
  │                                                            │
  │  ╭────────────────────────────────────────────────────────╮│
  │  │  Q-2026-001                                            ││
  │  │  Window installation                                   ││
  │  │  Hi Acme, please review your quote — valid until …     ││
  │  │  ─────────────────────────────────────                 ││
  │  │  Customer:  Acme · Acme Co.                            ││
  │  │  Subtotal:  1,250.00 EUR                               ││
  │  │  Total:     1,500.00 EUR                               ││
  │  │  ─────────────────────────────────────                 ││
  │  │  [ Download PDF ]                                      ││
  │  │  [  Accept  ]   [  Reject  ]                           ││
  │  ╰────────────────────────────────────────────────────────╯│
  └────────────────────────────────────────────────────────────┘
```

After the click + confirm dialog → terminal card with green "Accepted"
or red "Rejected" banner.

---

## 4. Operator checks

```sql
-- Tokens assigned for confirmed_sent quotations
SELECT id, reference_number, status, public_token, valid_until
  FROM public.quotations
 WHERE status = 'confirmed_sent'
 ORDER BY created_at DESC
 LIMIT 20;

-- Customer responses recorded in the last 30 days
SELECT id, reference_number, customer_name, status, responded_at, responded_ip
  FROM public.quotations
 WHERE responded_at IS NOT NULL
   AND responded_at >= now() - interval '30 days'
 ORDER BY responded_at DESC;

-- Audit log entries written by quotation-respond
SELECT entity_id, entity_name, changed_by_name, diff, created_at
  FROM public.audit_log
 WHERE entity_type = 'quotation'
   AND changed_by_name LIKE '% (customer)'
 ORDER BY created_at DESC LIMIT 20;
```

---

## 5. Troubleshooting

### "PDF not generated yet — confirm the quotation first"

The Send button is gated on `confirmed_sent`, but if you call the
function directly (curl / SDK) you can hit this. Click **Confirm &
Generate PDF** first.

### Email arrived but the buttons go to the wrong domain

`PUBLIC_APP_URL` isn't set on the function. Check:

```bash
supabase secrets list
```

Then re-deploy the function (it reads env on cold-start).

### Customer says "the page says it's already responded" but they didn't click

Inspect the audit log + quotations row:

```sql
SELECT status, responded_at, responded_ip, responded_user_agent
  FROM public.quotations WHERE public_token = '<token>';
```

If `responded_ip` is a Resend / Microsoft / Google IP, an email-prefetch
bot opened the link. We mitigate this by requiring an explicit click
on the page (not just landing). If you see this happening regularly,
adjust the email client's link-tracking settings.

### `Module not found "_shared/..."` on deploy

Both new functions are already self-contained — this error shouldn't
appear for them. If it appears for the four older email-senders
(`notify-inquiry`, `generate-quote`, `send-invite`, `generate-quotation`),
deploy via the Supabase CLI (which bundles `_shared/` automatically)
instead of the dashboard.

### Token leaked to a third party

The token is the only access capability for the link. Rotate it:

```sql
UPDATE public.quotations
   SET public_token = encode(gen_random_bytes(32), 'hex')
 WHERE id = '<quotation_uuid>';
```

Then click **Resend to customer** — the new email contains the new
token. Anyone holding the old link will see "Quote not found".

---

## 6. File reference

| Concern | File |
|---|---|
| DB schema + trigger + RLS | `migrations/067_quotation_public_response.sql` |
| Send the email | `supabase/functions/send-quotation-email/index.ts` |
| Record the response | `supabase/functions/quotation-respond/index.ts` |
| Customer-facing page | `configurator-admin/src/pages/public/PublicQuotationPage.tsx` |
| Route registration | `configurator-admin/src/App.tsx` (`/q/:token`) |
| Admin button | `configurator-admin/src/pages/quotations/QuotationDetailPage.tsx` (`handleSendToCustomer`) |
| Type-sync | `configurator-admin/src/types/database.ts` (`quotations.public_token` + `responded_*`) |
