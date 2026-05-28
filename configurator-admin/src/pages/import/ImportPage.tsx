import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Upload, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/components/auth/AuthContext'
import { useCanEdit } from '@/hooks/usePermission'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { t } from '@/i18n'
import { buildImportTemplateBytes } from '@/lib/catalogImport/template'
import { parseImportWorkbook } from '@/lib/catalogImport/parse'
import { SHEET_NAMES, type CatalogImportPayload, type ImportError, type ImportResult } from '@/lib/catalogImport/types'

interface ServerError {
  sheet?:   string | null
  row?:     number | null
  column?:  string | null
  message:  string
}

export function ImportPage() {
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const canEditLibrary  = useCanEdit('library')
  const canEditProducts = useCanEdit('products')
  const allowed = canEditLibrary && canEditProducts

  const fileRef = useRef<HTMLInputElement>(null)

  const [payload, setPayload]         = useState<CatalogImportPayload | null>(null)
  const [parseErrors, setParseErrors] = useState<ImportError[]>([])
  const [serverErrors, setServerErrors] = useState<ServerError[]>([])
  const [topLevelError, setTopLevelError] = useState('')
  const [importing, setImporting]     = useState(false)
  const [result, setResult]           = useState<ImportResult | null>(null)
  const [fileName, setFileName]       = useState<string | null>(null)

  async function handleDownloadTemplate() {
    try {
      const bytes = await buildImportTemplateBytes()
      const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'catalog-import-template.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setTopLevelError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setServerErrors([])
    setTopLevelError('')
    try {
      const buf = await file.arrayBuffer()
      const { payload, errors } = await parseImportWorkbook(buf)
      setPayload(payload)
      setParseErrors(errors)
    } catch (err) {
      setPayload(null)
      setParseErrors([])
      setTopLevelError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleImport() {
    if (!payload || parseErrors.length > 0) return
    setImporting(true)
    setServerErrors([])
    setTopLevelError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('import-catalog-xlsx', {
        body: { payload },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = res.data as { error?: string; message?: string; errors?: ServerError[]; result?: ImportResult } | null
      if (res.error || data?.error) {
        if (data?.errors) { setServerErrors(data.errors); return }
        setTopLevelError(data?.message ?? data?.error ?? res.error?.message ?? 'Import failed')
        return
      }
      if (data?.result) {
        setResult(data.result)
        setPayload(null)
        setFileName(null)
        if (fileRef.current) fileRef.current.value = ''
      }
    } catch (e) {
      setTopLevelError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  if (!profile) return null
  if (!allowed) {
    return (
      <div className="animate-fade-in p-6 max-w-lg">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('Bulk import requires edit access on both Library and Products.')}
        </div>
      </div>
    )
  }

  const counts = payload ? {
    classes:         payload.classes.length,
    characteristics: payload.characteristics.length,
    values:          payload.values.length,
    products:        payload.products.length,
    texts:           payload.texts.length,
  } : null

  const importable = payload != null && parseErrors.length === 0 && (counts ? Object.values(counts).some(c => c > 0) : false)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('Bulk import')}
        description={t('Upload an Excel workbook to create classes, characteristics, values, products and texts in one go.')}
      />

      <div className="p-6 max-w-4xl space-y-6">
        {/* Step 1: Download */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('1. Download the template')}</CardTitle>
            <CardDescription>
              {t('The workbook has five sheets — Classes, Characteristics, Values, Products, Texts — each with column instructions and one example row. Fill in your data, then upload the file below.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              {t('Download template')}
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('2. Upload your filled workbook')}</CardTitle>
            <CardDescription>
              {t('Validation runs immediately. Nothing is saved until you click Import.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {fileName ?? t('Click to upload an .xlsx file')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('Excel workbook with five sheets — same format as the template')}
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {topLevelError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{topLevelError}</span>
              </div>
            )}

            {parseErrors.length > 0 && (
              <ErrorList title={t('Validation errors')} errors={parseErrors} />
            )}

            {serverErrors.length > 0 && (
              <ErrorList title={t('Server validation errors')} errors={serverErrors} />
            )}
          </CardContent>
        </Card>

        {/* Step 3: Review + import */}
        {counts && parseErrors.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('3. Review and import')}</CardTitle>
              <CardDescription>{t('The workbook parsed cleanly. Review the totals below before importing.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <CountChip label={t('Classes')}         value={counts.classes} />
                <CountChip label={t('Characteristics')} value={counts.characteristics} />
                <CountChip label={t('Values')}          value={counts.values} />
                <CountChip label={t('Products')}        value={counts.products} />
                <CountChip label={t('Texts')}           value={counts.texts} />
              </div>
              <Button onClick={handleImport} loading={importing} disabled={!importable}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {t('Import catalog')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Success */}
        {result && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-3 text-center py-4">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-base font-semibold">{t('Catalog imported successfully')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-2">
                  <CountChip label={t('Classes')}         value={result.classes_created} />
                  <CountChip label={t('Characteristics')} value={result.characteristics_created} />
                  <CountChip label={t('Values')}          value={result.values_created} />
                  <CountChip label={t('Products')}        value={result.products_created} />
                  <CountChip label={t('Texts')}           value={result.texts_created} />
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={() => navigate('/products')}>{t('View products')}</Button>
                  <Button variant="outline" onClick={() => navigate('/library')}>{t('View library')}</Button>
                  <Button variant="ghost" onClick={() => setResult(null)}>{t('Import more')}</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function CountChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

function ErrorList({ title, errors }: { title: string; errors: (ImportError | ServerError)[] }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <p className="font-medium mb-1">{title}:</p>
      <ul className="space-y-0.5 max-h-72 overflow-auto">
        {errors.map((e, i) => (
          <li key={i} className="text-xs">
            {formatErrorLocation(e)}
            {e.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatErrorLocation(e: ImportError | ServerError): string {
  const parts: string[] = []
  if (e.sheet)  parts.push(e.sheet === SHEET_NAMES.characteristics ? 'Characteristics' : e.sheet)
  if (e.row != null) parts.push(`row ${e.row}`)
  if (e.column) parts.push(`column "${e.column}"`)
  return parts.length > 0 ? `${parts.join(' · ')} — ` : ''
}
