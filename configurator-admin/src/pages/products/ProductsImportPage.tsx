import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, AlertCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/components/auth/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { t } from '@/i18n'

interface PreviewRow {
  name: string
  description?: string
  base_price: string
  currency: string
  sku?: string
}

interface ValidationError { row: number; message: string }

// Client-side CSV preview parser (mirrors server logic, no insertion)
function parseCsvPreview(text: string): { rows: PreviewRow[]; error?: string } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return { rows: [], error: 'CSV must have a header row and at least one data row.' }

  function splitLine(line: string): string[] {
    const fields: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) { fields.push(cur); cur = '' }
      else cur += ch
    }
    fields.push(cur)
    return fields
  }

  const headers = splitLine(lines[0]).map(h => h.trim().toLowerCase())
  if (!headers.includes('name') && !headers.includes('product name') && !headers.includes('product')) {
    return { rows: [], error: 'CSV must have a "name" column.' }
  }

  const rows: PreviewRow[] = []
  for (let i = 1; i < Math.min(lines.length, 201); i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = splitLine(line)
    const raw: Record<string, string> = {}
    headers.forEach((h, idx) => { raw[h] = (values[idx] ?? '').trim() })

    rows.push({
      name:        raw['name'] || raw['product name'] || raw['product'] || '',
      description: raw['description'] || undefined,
      base_price:  raw['base_price'] || raw['price'] || raw['base price'] || '0',
      currency:    (raw['currency'] || 'EUR').toUpperCase(),
      sku:         raw['sku'] || undefined,
    })
  }

  return { rows }
}

export function ProductsImportPage() {
  const navigate  = useNavigate()
  const { planLimits } = useAuthContext()
  const fileRef   = useRef<HTMLInputElement>(null)

  const [csvText, setCsvText]       = useState('')
  const [preview, setPreview]       = useState<PreviewRow[]>([])
  const [parseError, setParseError] = useState('')
  const [importing, setImporting]   = useState(false)
  const [result, setResult]         = useState<{ created: number; products: { id: string; name: string }[] } | null>(null)
  const [serverErrors, setServerErrors] = useState<ValidationError[]>([])

  const canImport = planLimits ? (planLimits.products_max === -1 || planLimits.products_max > 3) : true

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setCsvText(text)
      setResult(null)
      setServerErrors([])
      const { rows, error } = parseCsvPreview(text)
      setParseError(error ?? '')
      setPreview(rows)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!csvText || parseError) return
    setImporting(true)
    setServerErrors([])
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('import-products-csv', {
        body: { csv: csvText },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error || (res.data as { error?: string })?.error) {
        const d = res.data as { error?: string; errors?: ValidationError[]; message?: string } | null
        if (d?.errors) { setServerErrors(d.errors); return }
        throw new Error(d?.message ?? d?.error ?? res.error?.message ?? 'Import failed')
      }
      setResult(res.data as { created: number; products: { id: string; name: string }[] })
      setCsvText('')
      setPreview([])
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  if (!canImport) {
    return (
      <div className="animate-fade-in p-6 max-w-lg">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('CSV import is available on Starter plan and above.')}
        </div>
        <Button variant="link" className="mt-3 p-0" onClick={() => navigate('/products')}>
          ← {t('Back to products')}
        </Button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('Import products from CSV')}
        description={t('Upload a CSV file to create multiple products at once.')}
      />

      <div className="px-6 pt-4">
        <button
          onClick={() => navigate('/products')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('All products')}
        </button>
      </div>

      <div className="p-6 max-w-3xl space-y-6">
        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('CSV format')}</CardTitle>
            <CardDescription>{t('Your file must include a header row. Supported columns:')}</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs border rounded-md overflow-hidden">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">{t('Column')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('Required')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('Example')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ['name', '✓', 'Bay Window 120cm'],
                  ['base_price', '✓', '299.00'],
                  ['currency', '', 'EUR'],
                  ['description', '', 'Double glazed bay window'],
                  ['sku', '', 'BW-120-DG'],
                  ['unit_of_measure', '', 'pcs'],
                ].map(([col, req, ex]) => (
                  <tr key={col}>
                    <td className="px-3 py-2 font-mono">{col}</td>
                    <td className="px-3 py-2 text-center">{req}</td>
                    <td className="px-3 py-2 text-muted-foreground">{ex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('Upload CSV')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t('Click to upload a CSV file')}</p>
                <p className="text-xs text-muted-foreground">{t('Max 200 rows')}</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange as unknown as React.ChangeEventHandler<HTMLInputElement>}
              />
            </div>

            {parseError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {parseError}
              </div>
            )}

            {serverErrors.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive space-y-1">
                <p className="font-medium">{t('Validation errors:')}</p>
                {serverErrors.map((e, i) => (
                  <p key={i}>Row {e.row}: {e.message}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview */}
        {preview.length > 0 && !result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('Preview')} — {preview.length} {t('products')}
              </CardTitle>
              <CardDescription>{t('Review before importing. All products will be created as drafts.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      {['Name', 'Price', 'Currency', 'SKU', 'Description'].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.slice(0, 10).map((row, i) => (
                      <tr key={i} className={!row.name ? 'bg-destructive/5' : ''}>
                        <td className="px-3 py-2">{row.name || <span className="text-destructive">missing</span>}</td>
                        <td className="px-3 py-2">{row.base_price}</td>
                        <td className="px-3 py-2">{row.currency}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.sku || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">{row.description || '—'}</td>
                      </tr>
                    ))}
                    {preview.length > 10 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-center text-muted-foreground text-xs">
                          {t('and')} {preview.length - 10} {t('more rows…')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <Button onClick={handleImport} loading={importing} disabled={!!parseError}>
                {t('Import')} {preview.length} {t('products')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Success */}
        {result && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-3 text-center py-4">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-base font-semibold">
                  {result.created} {t('products imported successfully')}
                </p>
                <p className="text-sm text-muted-foreground">{t('All products were created as drafts. Open each one to add characteristics and publish.')}</p>
                <div className="flex gap-2 mt-2">
                  <Button onClick={() => navigate('/products')}>{t('View products')}</Button>
                  <Button variant="outline" onClick={() => { setResult(null); if (fileRef.current) fileRef.current.value = '' }}>
                    {t('Import more')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
