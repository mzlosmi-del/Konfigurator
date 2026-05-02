import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateProduct } from '@/lib/products'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t } from '@/i18n'

export interface FormConfig {
  show_phone?: boolean
  show_company?: boolean
  gdpr_enabled?: boolean
  gdpr_text?: string
  gdpr_link?: string
  gdpr_link_text?: string
}

interface Props {
  productId: string
  initialConfig: FormConfig
  onSaved: (config: FormConfig) => void
}

function Toggle({
  checked, onChange, label, description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'mt-0.5 relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
          checked ? 'bg-primary' : 'bg-input',
        ].join(' ')}
      >
        <span className={[
          'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')} />
      </button>
      <div>
        <p className="text-sm font-medium leading-none">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </label>
  )
}

export function FormConfigPanel({ productId, initialConfig, onSaved }: Props) {
  const [cfg, setCfg] = useState<FormConfig>(initialConfig)
  const [saving, setSaving] = useState(false)
  const { toasts, toast, dismiss } = useToast()

  function patch(p: Partial<FormConfig>) { setCfg(c => ({ ...c, ...p })) }

  async function handleSave() {
    setSaving(true)
    try {
      await updateProduct(productId, { form_config: cfg as unknown as import('@/types/database').Json })
      onSaved(cfg)
      toast({ title: t('Form settings saved') })
    } catch (e) {
      toast({ title: t('Failed to save'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Optional fields */}
      <div className="space-y-4">
        <p className="text-sm font-semibold">{t('Optional fields')}</p>
        <Toggle
          checked={!!cfg.show_phone}
          onChange={v => patch({ show_phone: v })}
          label={t('Phone number')}
          description={t('Add an optional phone number field to the inquiry form.')}
        />
        <Toggle
          checked={!!cfg.show_company}
          onChange={v => patch({ show_company: v })}
          label={t('Company name')}
          description={t('Add an optional company name field to the inquiry form.')}
        />
      </div>

      {/* GDPR consent */}
      <div className="space-y-4 pt-4 border-t">
        <Toggle
          checked={!!cfg.gdpr_enabled}
          onChange={v => patch({ gdpr_enabled: v })}
          label={t('GDPR consent checkbox')}
          description={t('Require visitors to tick a consent box before submitting.')}
        />
        {cfg.gdpr_enabled && (
          <div className="space-y-3 pl-12">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('Consent text')}</label>
              <Input
                value={cfg.gdpr_text ?? ''}
                onChange={e => patch({ gdpr_text: e.target.value })}
                placeholder={t('I agree to the processing of my personal data.')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('Link text')}</label>
                <Input
                  value={cfg.gdpr_link_text ?? ''}
                  onChange={e => patch({ gdpr_link_text: e.target.value })}
                  placeholder={t('Privacy policy')}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('Link URL')}</label>
                <Input
                  value={cfg.gdpr_link ?? ''}
                  onChange={e => patch({ gdpr_link: e.target.value })}
                  placeholder="https://example.com/privacy"
                />
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span>{t('Preview')}: </span>
              <span>{cfg.gdpr_text || t('I agree to the processing of my personal data.')}</span>
              {cfg.gdpr_link && (
                <> <a href={cfg.gdpr_link} target="_blank" rel="noopener" className="underline text-primary">
                  {cfg.gdpr_link_text || t('Privacy policy')}
                </a></>
              )}
            </div>
          </div>
        )}
      </div>

      <Button size="sm" onClick={handleSave} loading={saving}>{t('Save form settings')}</Button>
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
