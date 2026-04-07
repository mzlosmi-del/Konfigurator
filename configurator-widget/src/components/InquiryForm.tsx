import { h } from 'preact'
import { useState } from 'preact/hooks'
import type { WidgetConfig, ConfigLineItem } from '../types'
import { submitInquiry } from '../api'

interface Props {
  config: WidgetConfig
  productId: string
  tenantId: string
  lineItems: ConfigLineItem[]
  totalPrice: number
  currency: string
  onSuccess: () => void
}

interface FormState {
  name: string
  email: string
  message: string
}

interface FormErrors {
  name?: string
  email?: string
}

export function InquiryForm({ config, productId, tenantId, lineItems, totalPrice, currency, onSuccess }: Props) {
  const [form, setForm] = useState<FormState>({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  function validate(): boolean {
    const errs: FormErrors = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    else if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) errs.email = 'Enter a valid email'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setServerError(null)

    try {
      await submitInquiry(config, {
        tenant_id: tenantId,
        product_id: productId,
        customer_name: form.name.trim(),
        customer_email: form.email.trim(),
        message: form.message.trim(),
        configuration: lineItems,
        total_price: totalPrice,
        currency,
      })
      onSuccess()
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Failed to submit. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div class="cw-inquiry-form">
      <p class="cw-inquiry-title">Request a quote</p>

      {serverError && (
        <div style={{ color: '#dc2626', fontSize: '13px', padding: '8px 12px', background: '#fef2f2', borderRadius: '6px' }}>
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div class="cw-field">
            <label>Your name *</label>
            <input
              type="text"
              placeholder="Ivan Horvat"
              value={form.name}
              onInput={(e) => setForm(f => ({ ...f, name: (e.target as HTMLInputElement).value }))}
              autocomplete="name"
            />
            {errors.name && <span class="cw-field-error">{errors.name}</span>}
          </div>

          <div class="cw-field">
            <label>Email address *</label>
            <input
              type="email"
              placeholder="ivan@example.com"
              value={form.email}
              onInput={(e) => setForm(f => ({ ...f, email: (e.target as HTMLInputElement).value }))}
              autocomplete="email"
            />
            {errors.email && <span class="cw-field-error">{errors.email}</span>}
          </div>

          <div class="cw-field">
            <label>Message (optional)</label>
            <textarea
              rows={3}
              placeholder="Any additional details or questions…"
              value={form.message}
              onInput={(e) => setForm(f => ({ ...f, message: (e.target as HTMLTextAreaElement).value }))}
            />
          </div>

          <button
            type="submit"
            class="cw-submit-btn"
            disabled={submitting}
          >
            {submitting ? 'Sending…' : 'Send inquiry'}
          </button>
        </div>
      </form>
    </div>
  )
}
