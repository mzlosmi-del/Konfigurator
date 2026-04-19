import type { QuotationStatus } from '@/types/database'

export const STATUS_OPTIONS: QuotationStatus[] = [
  'in_preparation',
  'confirmed_sent',
  'accepted_no_changes',
  'accepted_with_changes',
  'rejected',
  'expired',
]

export const STATUS_LABELS: Record<QuotationStatus, string> = {
  in_preparation:        'In preparation',
  confirmed_sent:        'Confirmed & sent',
  accepted_no_changes:   'Accepted — no changes',
  accepted_with_changes: 'Accepted with changes',
  rejected:              'Rejected',
  expired:               'Expired',
}

export const statusVariant: Record<QuotationStatus, 'secondary' | 'warning' | 'success' | 'destructive' | 'outline'> = {
  in_preparation:        'secondary',
  confirmed_sent:        'warning',
  accepted_no_changes:   'success',
  accepted_with_changes: 'success',
  rejected:              'destructive',
  expired:               'outline',
}
