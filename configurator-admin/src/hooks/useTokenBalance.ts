import { useAuthContext } from '@/components/auth/AuthContext'

/**
 * Token balance for the current tenant. The balance lives on the `tenant` row
 * already loaded by AuthContext, so this is a thin derived view — no extra
 * fetch. Call `refresh()` after a charge (e.g. issuing a quotation) so gated
 * buttons re-evaluate against the new remaining balance.
 */
export function useTokenBalance() {
  const { tenant, refreshTenant } = useAuthContext()
  const granted = tenant?.tokens_granted ?? 0
  const spent = tenant?.tokens_spent ?? 0
  return {
    granted,
    spent,
    remaining: granted - spent,
    refresh: refreshTenant,
  }
}
