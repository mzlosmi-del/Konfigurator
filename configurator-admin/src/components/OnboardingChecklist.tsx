import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { Product } from '@/types/database'
import { t } from '@/i18n'

interface Props {
  products: Product[]
  tenantId: string
}

interface Step {
  label: string
  description: string
  done: boolean
  href?: string
}

function dismissedKey(tenantId: string) {
  return `cw_onboarding_dismissed_${tenantId}`
}

export function embedCopiedKey(tenantId: string) {
  return `cw_embed_copied_${tenantId}`
}

export function OnboardingChecklist({ products, tenantId }: Props) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(dismissedKey(tenantId)) === '1'
  )

  const embedCopied = localStorage.getItem(embedCopiedKey(tenantId)) === '1'
  const hasProduct   = products.length > 0
  const hasPublished = products.some(p => p.status === 'published')

  const steps: Step[] = [
    {
      label: t('Create your account'),
      description: t('Your workspace is ready.'),
      done: true,
    },
    {
      label: t('Create your first product'),
      description: t('Add a configurable product with options and pricing.'),
      done: hasProduct,
      href: '/products/new',
    },
    {
      label: t('Publish the product'),
      description: t('Make it live so the widget can load it.'),
      done: hasPublished,
      href: '/products',
    },
    {
      label: t('Copy the embed code'),
      description: t('Paste the snippet into your website.'),
      done: embedCopied,
      href: hasProduct ? `/products/${products[0]?.id}/edit` : '/products',
    },
  ]

  const doneCount = steps.filter(s => s.done).length
  const allDone   = doneCount === steps.length

  if (dismissed || allDone) return null

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {steps.map((s, i) => (
              <div
                key={i}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  s.done ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-medium">
            {t('Get started')} — {doneCount}/{steps.length} {t('steps complete')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
            onClick={e => {
              e.stopPropagation()
              localStorage.setItem(dismissedKey(tenantId), '1')
              setDismissed(true)
            }}
          >
            {t('Dismiss')}
          </button>
          {collapsed
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronUp className="h-4 w-4 text-muted-foreground" />
          }
        </div>
      </div>

      {/* Steps */}
      {!collapsed && (
        <div className="border-t divide-y">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 px-4 py-3 ${
                !step.done && step.href ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''
              }`}
              onClick={() => { if (!step.done && step.href) navigate(step.href) }}
            >
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                step.done
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted-foreground/30'
              }`}>
                {step.done && <Check className="h-3.5 w-3.5" />}
                {!step.done && <span className="text-xs font-medium text-muted-foreground">{i + 1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${step.done ? 'line-through text-muted-foreground' : ''}`}>
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {!step.done && step.href && (
                <span className="text-xs text-primary font-medium shrink-0">{t('Start')} →</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
