import type { QuotationStatus } from '@/types/database'

export const STATUS_OPTIONS: QuotationStatus[] = [
  'in_preparation',
  'confirmed',
  'sent',
  'accepted_no_changes',
  'accepted_with_changes',
  'rejected',
  'expired',
]

export const STATUS_LABELS: Record<QuotationStatus, string> = {
  in_preparation:        'In preparation',
  confirmed:             'Confirmed',
  sent:                  'Sent to customer',
  accepted_no_changes:   'Accepted — no changes',
  accepted_with_changes: 'Accepted with changes',
  rejected:              'Rejected',
  expired:               'Expired',
}

export const statusVariant: Record<QuotationStatus, 'secondary' | 'warning' | 'success' | 'destructive' | 'outline'> = {
  in_preparation:        'secondary',
  confirmed:             'secondary',
  sent:                  'warning',
  accepted_no_changes:   'success',
  accepted_with_changes: 'success',
  rejected:              'destructive',
  expired:               'outline',
}

// Allowed forward-only status transitions from a given current state.
// `confirmed` is reached only via the explicit Confirm-and-Generate-PDF
// action, and `sent` only via the Send-to-customer action — neither is
// settable from the status dropdown. Terminal states have no transitions.
export const STATUS_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  in_preparation:        ['rejected'],
  confirmed:             ['rejected'],
  sent:                  ['accepted_no_changes', 'accepted_with_changes', 'rejected', 'expired'],
  accepted_no_changes:   [],
  accepted_with_changes: [],
  rejected:              [],
  expired:               [],
}
