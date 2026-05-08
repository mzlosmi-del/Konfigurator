# Billing Operations (Sales-Led)

We do not run self-serve Stripe checkout in-product right now. Plan
changes and renewals are handled by sales: you (the operator) record
what was paid for, and the app reflects it.

This runbook covers the manual SQL you'll run after each plan
transaction. The Stripe-sync columns (`current_period_end`,
`cancel_at_period_end`) are scaffolding for when self-serve billing is
turned back on; ignore them for now.

---

## What's tracked

`tenants` columns relevant to billing (after migration 066):

| Column | Source | Used for |
|---|---|---|
| `plan` | manual or Stripe | Which features are unlocked |
| `paid_until` | **manual (you)** | Date the current paid period ends — shown on Billing tab |
| `subscription_status` | manual or Stripe | Lifecycle label (`active`, `canceled`, …) — optional |
| `current_period_end` | Stripe webhook (off) | Future Stripe sync |
| `cancel_at_period_end` | Stripe webhook (off) | Future Stripe sync |
| `grace_period_ends_at` | Stripe webhook | Set on payment failure (still wired) |
| `stripe_customer_id` | Stripe checkout (off) | Future Stripe sync |
| `stripe_subscription_id` | Stripe checkout (off) | Future Stripe sync |

The Billing tab in Settings displays the value of `paid_until` first,
falling back to `current_period_end` if `paid_until` is null. The label
adapts: "Paid until" / "Renews on" / "Cancels on". If neither column is
set, no expiry line is shown.

---

## Common operations

### Activate a new tenant on Scale for one year

Run this after sales receives payment:

```sql
UPDATE public.tenants
   SET plan        = 'scale',
       paid_until  = (now() + interval '1 year')::date,   -- end of paid period
       subscription_status = 'active'
 WHERE id = '<tenant_uuid>';

SELECT public.apply_plan_upgrade('<tenant_uuid>'::uuid);
```

Replace `'1 year'` with `'1 month'`, `'6 months'`, etc. as appropriate.
The `apply_plan_upgrade` call clears any stale read-only flags from a
prior downgrade (no-op if there was none).

### Renew an existing tenant

Just push `paid_until` forward:

```sql
UPDATE public.tenants
   SET paid_until = (paid_until + interval '1 year'),
       subscription_status = 'active'
 WHERE id = '<tenant_uuid>';
```

If `paid_until` was null or already in the past, use `now() + interval`
instead so you don't accidentally back-date the renewal.

### Cancel / downgrade at end of paid period

Two-step. First, decide whether they keep their current plan until the
paid period ends or get downgraded immediately.

**Keep until paid_until expires** (graceful, recommended):

Don't change anything yet. Set yourself a reminder for `paid_until`. On
that date, run:

```sql
UPDATE public.tenants SET plan = 'free', subscription_status = 'canceled'
 WHERE id = '<tenant_uuid>';
SELECT public.apply_plan_downgrade('<tenant_uuid>'::uuid);
```

**Downgrade immediately**:

```sql
UPDATE public.tenants SET plan = 'free', paid_until = now(), subscription_status = 'canceled'
 WHERE id = '<tenant_uuid>';
SELECT public.apply_plan_downgrade('<tenant_uuid>'::uuid);
```

`apply_plan_downgrade` runs the cleanup: marks excess products
read-only, disables webhooks if the new plan has no webhooks feature,
turns off AR / marks 3D assets read-only if the new plan has no
`three_d`, zeroes the AI counter if AI dropped to 0.

### Change plan without changing paid period

```sql
UPDATE public.tenants SET plan = 'growth' WHERE id = '<tenant_uuid>';
SELECT public.apply_plan_downgrade('<tenant_uuid>'::uuid);   -- if going down
SELECT public.apply_plan_upgrade('<tenant_uuid>'::uuid);     -- if going up
```

Both helpers are idempotent — running both is safe and the right move
when you don't want to think about direction.

### Find tenants whose plan expires soon

```sql
SELECT id, name, plan, paid_until
  FROM public.tenants
 WHERE plan <> 'free'
   AND paid_until IS NOT NULL
   AND paid_until BETWEEN now() AND now() + interval '14 days'
 ORDER BY paid_until;
```

Useful to drive a renewal-reminder workflow.

### Find tenants who already expired

```sql
SELECT id, name, plan, paid_until
  FROM public.tenants
 WHERE plan <> 'free'
   AND paid_until IS NOT NULL
   AND paid_until < now()
 ORDER BY paid_until;
```

These are tenants on a paid plan whose `paid_until` is in the past but
who haven't been downgraded yet — i.e. they're still using paid features
without having paid. Run the cancel/downgrade SQL above for each.

---

## Notes on Stripe-readiness

The columns `current_period_end`, `cancel_at_period_end`,
`stripe_customer_id`, and `stripe_subscription_id` exist but are **not
populated** by anything right now. The `stripe-webhook` Edge Function
processes `subscription.updated` and `subscription.deleted` events for
plan change + downgrade safety, but does NOT set the period-end columns
yet.

When self-serve Stripe is re-enabled (un-removing the buttons in the
Billing tab), the webhook will need a small extension:

```ts
// in stripe-webhook customer.subscription.updated / checkout.session.completed:
await supabase.from('tenants').update({
  current_period_end:    new Date(sub.current_period_end * 1000).toISOString(),
  cancel_at_period_end:  sub.cancel_at_period_end,
  // existing fields …
} as never).eq('id', tenantId)
```

The Billing tab already prefers `paid_until` over `current_period_end`,
so once Stripe is back, you can just clear `paid_until` for any
self-serve tenant and the UI will switch to the Stripe-driven date
automatically.
