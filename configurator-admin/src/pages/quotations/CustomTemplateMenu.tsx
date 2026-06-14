// "Custom templates" export entry point on the quotation detail page.
//
// ADDITIVE: this sits alongside the existing PDF/DOCX/XLSX/Tech-spec exports
// and never touches them. It lists the tenant's saved document_templates and,
// when one is picked, builds the real render context from THIS quotation and
// downloads the generated file. PdfLayoutDialog and the canonical exports are
// unchanged.

import { useEffect, useRef, useState } from 'react'
import { LayoutTemplate, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { t } from '@/i18n'
import type { Quotation, QuotationLineItem, VisualizationAsset } from '@/types/database'
import type { OutputLang } from '@/lib/languages'
import type { TenantProfile } from '@/lib/pdf/shared'
import { fetchQuotationTexts } from '@/lib/texts'
import { fetchImageAssetsForProducts } from '@/lib/assets'
import { listTemplates, type DocumentTemplateRow } from '@/lib/docTemplate/templates'
import { renderTemplateToPdf } from '@/lib/docTemplate/renderPdf'
import { renderTemplateToDocx } from '@/lib/docTemplate/renderDocx'
import { renderTemplateToXlsx } from '@/lib/docTemplate/renderXlsx'
import { downloadBytes } from '@/lib/docTemplate/download'
import type { ImageResolver } from '@/lib/docTemplate/context'

interface Props {
  quotation:           Quotation
  buildTenantProfile:  () => Promise<TenantProfile>
  lang:                OutputLang
  onError:             (message: string) => void
  disabled?:           boolean
}

export function CustomTemplateMenu({ quotation, buildTenantProfile, lang, onError, disabled }: Props) {
  const [open, setOpen]           = useState(false)
  const [loading, setLoading]     = useState(false)
  const [templates, setTemplates] = useState<DocumentTemplateRow[] | null>(null)
  const [busyId, setBusyId]       = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && templates === null) {
      setLoading(true)
      try {
        setTemplates(await listTemplates())
      } catch (err) {
        onError(String(err))
        setTemplates([])
      } finally {
        setLoading(false)
      }
    }
  }

  async function run(tpl: DocumentTemplateRow) {
    setBusyId(tpl.id)
    try {
      const lineItems  = (Array.isArray(quotation.line_items) ? quotation.line_items : []) as unknown as QuotationLineItem[]
      const productIds = [...new Set(lineItems.map(li => li.product_id).filter(Boolean))] as string[]
      const charIds    = [...new Set(lineItems.flatMap(li => (li.configuration ?? []).map(c => c.characteristic_id)).filter(Boolean))] as string[]
      const valueIds   = [...new Set(lineItems.flatMap(li => (li.configuration ?? []).map(c => c.value_id)).filter(Boolean))] as string[]

      const [tenant, texts, assets] = await Promise.all([
        buildTenantProfile(),
        fetchQuotationTexts(productIds, charIds, valueIds),
        fetchImageAssetsForProducts(productIds),
      ])

      const images = buildImageResolver(assets)
      const args = { definition: tpl.definition, quotation, tenant, texts, lang, images }
      const fileBase = quotation.reference_number ?? 'document'
      if (tpl.output_kind === 'pdf')       downloadBytes(await renderTemplateToPdf(args),  'pdf',  fileBase)
      else if (tpl.output_kind === 'docx') downloadBytes(await renderTemplateToDocx(args), 'docx', fileBase)
      else                                 downloadBytes(await renderTemplateToXlsx(args), 'xlsx', fileBase)
      setOpen(false)
    } catch (err) {
      onError(String(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" onClick={toggle} disabled={disabled} title={disabled ? t('Insufficient tokens') : undefined}>
        <LayoutTemplate className="h-4 w-4 mr-1.5" />
        {t('Custom templates')}
        <ChevronDown className="h-3.5 w-3.5 ml-1" />
      </Button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-background border rounded-md shadow-lg z-50 py-1">
          {loading ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : !templates || templates.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">{t('No custom templates yet. Create one under Templates.')}</p>
          ) : (
            templates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => run(tpl)}
                disabled={busyId !== null}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 disabled:opacity-50"
              >
                <span className="truncate">{tpl.name}</span>
                {busyId === tpl.id
                  ? <Spinner size="sm" />
                  : <span className="text-[10px] uppercase text-muted-foreground shrink-0">{tpl.output_kind}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/** Build a product/value → image-URL resolver from visualization assets. Uses
 *  the default (characteristic_value_id null) asset for products and the
 *  per-value asset for config items. */
function buildImageResolver(assets: VisualizationAsset[]): ImageResolver {
  const productImg = new Map<string, string>()
  const valueImg   = new Map<string, string>()
  for (const a of assets) {
    if (a.asset_type !== 'image') continue
    if (a.characteristic_value_id) {
      if (!valueImg.has(a.characteristic_value_id)) valueImg.set(a.characteristic_value_id, a.url)
    } else if (a.product_id) {
      if (a.is_default || !productImg.has(a.product_id)) productImg.set(a.product_id, a.url)
    }
  }
  return {
    productImage: (id) => productImg.get(id) ?? null,
    valueImage:   (id) => valueImg.get(id) ?? null,
  }
}
