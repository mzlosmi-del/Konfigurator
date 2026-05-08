/**
 * Shared helper for resolving the From-address used by the various
 * email-sending Edge Functions (notify-inquiry, generate-quote,
 * generate-quotation, send-invite, send-quotation-email, …).
 *
 * Returns the tenant-configured email_from_address only when:
 *   1. The tenant's plan includes the white_label feature, AND
 *   2. The address has been marked verified (email_from_verified = true)
 *      either by the verify-email-domain Edge Function (Resend Domains API)
 *      or manually by an admin who confirmed the DNS records out-of-band.
 *
 * Falls back to NOTIFY_FROM_EMAIL otherwise.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_FROM = 'notifications@konfigurator.app'

export async function getFromAddress(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
): Promise<string> {
  const fallback = Deno.env.get('NOTIFY_FROM_EMAIL') ?? DEFAULT_FROM

  // Single round-trip: pull the tenant's address + verified flag and
  // check the white_label feature in parallel.
  const [{ data: tenant }, { data: hasFeature }] = await Promise.all([
    sb.from('tenants')
      .select('email_from_address, email_from_verified')
      .eq('id', tenantId)
      .maybeSingle(),
    sb.rpc('tenant_has_feature', { p_tenant_id: tenantId, p_feature: 'white_label' }),
  ])

  if (hasFeature !== true) return fallback
  const t = tenant as { email_from_address: string | null; email_from_verified: boolean } | null
  if (!t?.email_from_address || !t.email_from_verified) return fallback
  return t.email_from_address
}
