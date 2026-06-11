import { h } from 'preact'
import { useState } from 'preact/hooks'
import type { WidgetConfig, ConfigLineItem, FormConfig } from '../types'
import { submitInquiry, PlanLimitError, createSupabaseClient } from '../api'
import { uploadInquiryFiles, validateFiles, formatBytes, MAX_FILES } from '../uploads'
import { t } from '../i18n'

interface Props {
  config: WidgetConfig
  productId: string
  tenantId: string
  lineItems: ConfigLineItem[]
  totalPrice: number
  currency: string
  formConfig?: FormConfig
  /** When true, render the image-upload control (product.uploads_possible). */
  uploadsEnabled?: boolean
  onSuccess: () => void
}

interface FormState {
  name: string
  email: string
  phone: string
  company: string
  message: string
  gdprConsent: boolean
}

interface FormErrors {
  name?: string
  email?: string
  gdpr?: string
}

export function InquiryForm({ config, productId, tenantId, lineItems, totalPrice, currency, formConfig = {}, uploadsEnabled = false, onSuccess }: Props) {
  const [form, setForm] = useState<FormState>({ name: '', email: '', phone: '', company: '', message: '', gdprConsent: false })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)

  function addFiles(incoming: File[]) {
    setFileError(null)
    const next = [...files, ...incoming].slice(0, MAX_FILES)
    const err = validateFiles(next)
    if (err) { setFileError(err); return }
    setFiles(next)
  }

  function removeFile(idx: number) {
    setFileError(null)
    setFiles(files.filter((_, i) => i !== idx))
  }

  function validate(): boolean {
    const errs: FormErrors = {}
    if (!form.name.trim()) errs.name = t('Name is required')
    if (!form.email.trim()) errs.email = t('Email is required')
    else if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) errs.email = t('Enter a valid email')
    if (formConfig.gdpr_enabled && !form.gdprConsent) errs.gdpr = t('You must accept to continue')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!validate()) return

    // Validate any attached files up-front so we don't create an inquiry that
    // we then can't attach the files to.
    if (uploadsEnabled && files.length > 0) {
      const fErr = validateFiles(files)
      if (fErr) { setFileError(fErr); return }
    }

    setSubmitting(true)
    setServerError(null)

    try {
      const { id: inquiryId } = await submitInquiry(config, {
        tenant_id: tenantId,
        product_id: productId,
        customer_name: form.name.trim(),
        customer_email: form.email.trim(),
        message: [
          form.phone.trim() ? `Phone: ${form.phone.trim()}` : '',
          form.company.trim() ? `Company: ${form.company.trim()}` : '',
          form.message.trim(),
        ].filter(Boolean).join('\n') || null,
        configuration: lineItems,
        total_price: totalPrice,
        currency,
      })

      // The inquiry row now exists. Attempt file uploads as a best-effort
      // follow-up: the inquiry is already recorded, so an upload failure must
      // not block submission — it falls through to the success state.
      if (uploadsEnabled && files.length > 0) {
        try {
          const sb = createSupabaseClient(config)
          await uploadInquiryFiles(sb, tenantId, inquiryId, files)
        } catch {
          // Non-fatal: the company still received the inquiry. Swallow so the
          // customer sees the thank-you screen rather than a confusing error.
        }
      }

      onSuccess()
    } catch (err) {
      if (err instanceof PlanLimitError) {
        setServerError(t('Quote requests are temporarily paused. Please contact us directly.'))
      } else {
        setServerError(
          err instanceof Error ? err.message : t('Failed to submit. Please try again.')
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  const gdprText = formConfig.gdpr_text || t('I agree to the processing of my personal data.')

  return (
    <div class="cw-inquiry-form">
      <p class="cw-inquiry-title">{t('Request a quote')}</p>

      {serverError && (
        <div style={{ color: '#dc2626', fontSize: '13px', padding: '8px 12px', background: '#fef2f2', borderRadius: '6px' }}>
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div class="cw-field">
            <label>{t('Your name *')}</label>
            <input
              type="text"
              placeholder={t('John Smith')}
              value={form.name}
              onInput={(e) => setForm(f => ({ ...f, name: (e.target as HTMLInputElement).value }))}
              autocomplete="name"
            />
            {errors.name && <span class="cw-field-error">{errors.name}</span>}
          </div>

          <div class="cw-field">
            <label>{t('Email address *')}</label>
            <input
              type="email"
              placeholder={t('john@example.co.uk')}
              value={form.email}
              onInput={(e) => setForm(f => ({ ...f, email: (e.target as HTMLInputElement).value }))}
              autocomplete="email"
            />
            {errors.email && <span class="cw-field-error">{errors.email}</span>}
          </div>

          {formConfig.show_phone && (
            <div class="cw-field">
              <label>{t('Phone number')}</label>
              <input
                type="tel"
                placeholder="07700 900123"
                value={form.phone}
                onInput={(e) => setForm(f => ({ ...f, phone: (e.target as HTMLInputElement).value }))}
                autocomplete="tel"
              />
            </div>
          )}

          {formConfig.show_company && (
            <div class="cw-field">
              <label>{t('Company name')}</label>
              <input
                type="text"
                placeholder={t('Acme Ltd')}
                value={form.company}
                onInput={(e) => setForm(f => ({ ...f, company: (e.target as HTMLInputElement).value }))}
                autocomplete="organization"
              />
            </div>
          )}

          <div class="cw-field">
            <label>{t('Message (optional)')}</label>
            <textarea
              rows={3}
              placeholder={t('Any additional details or questions\u2026')}
              value={form.message}
              onInput={(e) => setForm(f => ({ ...f, message: (e.target as HTMLTextAreaElement).value }))}
            />
          </div>

          {uploadsEnabled && (
            <div class="cw-field">
              <label>{t('Attach images (optional)')}</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif"
                multiple
                disabled={files.length >= MAX_FILES}
                onChange={(e) => {
                  const input = e.target as HTMLInputElement
                  addFiles(Array.from(input.files ?? []))
                  // Reset so picking the same file again re-fires onChange.
                  input.value = ''
                }}
              />
              <span class="cw-field-hint">
                {t('Allowed formats: JPG, PNG, GIF, WebP, HEIC. Up to 3 files, max 20 MB each.')}
              </span>
              {fileError && <span class="cw-field-error">{fileError}</span>}
              {files.length > 0 && (
                <ul class="cw-file-list">
                  {files.map((f, i) => (
                    <li class="cw-file-item" key={`${f.name}-${i}`}>
                      <span class="cw-file-name">{f.name}</span>
                      <span class="cw-file-size">{formatBytes(f.size)}</span>
                      <button
                        type="button"
                        class="cw-file-remove"
                        onClick={() => removeFile(i)}
                        aria-label={t('Remove')}
                      >
                        \u00d7
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {formConfig.gdpr_enabled && (
            <div class="cw-field">
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.gdprConsent}
                  style={{ marginTop: '2px', flexShrink: 0 }}
                  onChange={(e) => setForm(f => ({ ...f, gdprConsent: (e.target as HTMLInputElement).checked }))}
                />
                <span style={{ fontSize: '12px', lineHeight: '1.4' }}>
                  {gdprText}
                  {formConfig.gdpr_link && (
                    <> <a href={formConfig.gdpr_link} target="_blank" rel="noopener" style={{ color: '#2563eb' }}>
                      {formConfig.gdpr_link_text || t('Privacy policy')}
                    </a></>
                  )}
                </span>
              </label>
              {errors.gdpr && <span class="cw-field-error">{errors.gdpr}</span>}
            </div>
          )}

          <button
            type="submit"
            class="cw-submit-btn"
            disabled={submitting}
          >
            {submitting ? t('Sending\u2026') : t('Send inquiry')}
          </button>
        </div>
      </form>
    </div>
  )
}
