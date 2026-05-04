import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, CalendarRange } from 'lucide-react'
import { fetchProducts } from '@/lib/products'
import {
  fetchPriceSchedules,
  upsertPriceSchedule,
  deletePriceSchedule,
  fetchAllModifierSchedules,
  upsertModifierSchedule,
  deleteModifierSchedule,
  fetchTaxPresets,
  upsertTaxPreset,
  deleteTaxPreset,
  fetchAdjustmentPresets,
  upsertAdjustmentPreset,
  deleteAdjustmentPreset,
  type ProductPriceSchedule,
  type CharModifierSchedule,
  type ProductTaxPreset,
  type ProductAdjustmentPreset,
} from '@/lib/pricing'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { t } from '@/i18n'
import { useAuthContext } from '@/components/auth/AuthContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function isActive(validFrom: string, validTo: string | null): boolean {
  const d = today()
  return d >= validFrom && (validTo === null || d <= validTo)
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return d
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
      active ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'
    }`}>
      {active ? t('Active') : t('Inactive')}
    </span>
  )
}

// ── Base Prices tab ───────────────────────────────────────────────────────────

function BasePricesTab({ products, tenantId }: { products: Product[], tenantId: string }) {
  const { toasts, toast, dismiss } = useToast()
  const [schedules, setSchedules] = useState<ProductPriceSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id ?? '')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProductPriceSchedule | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [form, setForm] = useState({ price: '', valid_from: today(), valid_to: '', note: '' })

  const load = useCallback(async () => {
    if (!selectedProduct) return
    setLoading(true)
    try { setSchedules(await fetchPriceSchedules(selectedProduct)) }
    catch (e: any) { toast({ title: t('Error'), description: e.message, variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [selectedProduct])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    setForm({ price: '', valid_from: today(), valid_to: '', note: '' })
    setDialogOpen(true)
  }

  function openEdit(s: ProductPriceSchedule) {
    setEditing(s)
    setForm({ price: String(s.price), valid_from: s.valid_from, valid_to: s.valid_to ?? '', note: s.note ?? '' })
    setDialogOpen(true)
  }

  async function handleSave() {
    const price = parseFloat(form.price)
    if (isNaN(price) || price < 0) { toast({ title: t('Invalid price'), variant: 'destructive' }); return }
    if (!form.valid_from) { toast({ title: t('Valid from is required'), variant: 'destructive' }); return }
    try {
      const row = {
        ...(editing ? { id: editing.id } : {}),
        tenant_id: tenantId,
        product_id: selectedProduct,
        price,
        valid_from: form.valid_from,
        valid_to: form.valid_to || null,
        note: form.note || null,
      }
      await upsertPriceSchedule(row as any)
      setDialogOpen(false)
      await load()
      toast({ title: editing ? t('Updated') : t('Created') })
    } catch (e: any) { toast({ title: t('Error'), description: e.message, variant: 'destructive' }) }
  }

  async function handleDelete() {
    if (!deleteId) return
    try { await deletePriceSchedule(deleteId); await load(); toast({ title: t('Deleted') }) }
    catch (e: any) { toast({ title: t('Error'), description: e.message, variant: 'destructive' }) }
    finally { setDeleteId(null) }
  }

  const product = products.find(p => p.id === selectedProduct)

  return (
    <div className="space-y-4">
      <Toaster toasts={toasts} onDismiss={dismiss} />
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="w-56">
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />{t('Add schedule')}</Button>
      </div>

      {product && (
        <p className="text-sm text-muted-foreground">
          {t('Catalogue base price:')} <strong>{product.currency} {product.base_price.toFixed(2)}</strong>
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : schedules.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">{t('No schedules yet.')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/30 text-muted-foreground">
                  <th className="text-left px-4 py-2">{t('Price')}</th>
                  <th className="text-left px-4 py-2">{t('Valid from')}</th>
                  <th className="text-left px-4 py-2">{t('Valid to')}</th>
                  <th className="text-left px-4 py-2">{t('Status')}</th>
                  <th className="text-left px-4 py-2 hidden sm:table-cell">{t('Note')}</th>
                  <th className="px-4 py-2" />
                </tr></thead>
                <tbody>
                  {schedules.map(s => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2 font-medium">{product?.currency ?? ''} {Number(s.price).toFixed(2)}</td>
                      <td className="px-4 py-2">{fmtDate(s.valid_from)}</td>
                      <td className="px-4 py-2">{fmtDate(s.valid_to)}</td>
                      <td className="px-4 py-2"><ActiveBadge active={isActive(s.valid_from, s.valid_to)} /></td>
                      <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{s.note ?? ''}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('Edit price schedule') : t('New price schedule')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium">{t('Price')} ({product?.currency})</label>
              <Input type="number" min={0} step={0.01} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t('Valid from')}</label>
                <Input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">{t('Valid to')}</label>
                <Input type="date" value={form.valid_to} onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t('Note (optional)')}</label>
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder={t('e.g. Summer promo')} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild><Button variant="outline">{t('Cancel')}</Button></DialogClose>
            <Button onClick={handleSave}>{t('Save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        title={t('Delete schedule')}
        description={t('Remove this price schedule?')}
        onConfirm={handleDelete}
        onOpenChange={open => { if (!open) setDeleteId(null) }}
      />
    </div>
  )
}

// ── Characteristic Modifiers tab ──────────────────────────────────────────────

interface CharValueOption { id: string; label: string; charName: string }

function ModifiersTab({ tenantId }: { products: Product[], tenantId: string }) {
  const { toasts, toast, dismiss } = useToast()
  const [allSchedules, setAllSchedules] = useState<CharModifierSchedule[]>([])
  const [charValues, setCharValues] = useState<CharValueOption[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CharModifierSchedule | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ characteristic_value_id: '', price_modifier: '', valid_from: today(), valid_to: '', note: '' })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [schedules] = await Promise.all([fetchAllModifierSchedules()])
      setAllSchedules(schedules)
      const { data } = await supabase
        .from('characteristic_values')
        .select('id, label, characteristic_id')
        .order('label')
      const { data: chars } = await supabase
        .from('characteristics')
        .select('id, name')
      const charMap: Record<string, string> = {}
      for (const c of (chars ?? [])) charMap[(c as any).id] = (c as any).name
      setCharValues((data ?? []).map((v: any) => ({
        id: v.id,
        label: v.label,
        charName: charMap[v.characteristic_id] ?? '—',
      })))
    } catch (e: any) { toast({ title: t('Error'), description: e.message, variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openNew() {
    setEditing(null)
    setForm({ characteristic_value_id: charValues[0]?.id ?? '', price_modifier: '', valid_from: today(), valid_to: '', note: '' })
    setDialogOpen(true)
  }

  function openEdit(s: CharModifierSchedule) {
    setEditing(s)
    setForm({ characteristic_value_id: s.characteristic_value_id, price_modifier: String(s.price_modifier), valid_from: s.valid_from, valid_to: s.valid_to ?? '', note: s.note ?? '' })
    setDialogOpen(true)
  }

  async function handleSave() {
    const mod = parseFloat(form.price_modifier)
    if (isNaN(mod)) { toast({ title: t('Invalid modifier'), variant: 'destructive' }); return }
    if (!form.characteristic_value_id) { toast({ title: t('Select a characteristic value'), variant: 'destructive' }); return }
    if (!form.valid_from) { toast({ title: t('Valid from is required'), variant: 'destructive' }); return }
    try {
      const row = {
        ...(editing ? { id: editing.id } : {}),
        tenant_id: tenantId,
        characteristic_value_id: form.characteristic_value_id,
        price_modifier: mod,
        valid_from: form.valid_from,
        valid_to: form.valid_to || null,
        note: form.note || null,
      }
      await upsertModifierSchedule(row as any)
      setDialogOpen(false)
      await loadData()
      toast({ title: editing ? t('Updated') : t('Created') })
    } catch (e: any) { toast({ title: t('Error'), description: e.message, variant: 'destructive' }) }
  }

  async function handleDelete() {
    if (!deleteId) return
    try { await deleteModifierSchedule(deleteId); await loadData(); toast({ title: t('Deleted') }) }
    catch (e: any) { toast({ title: t('Error'), description: e.message, variant: 'destructive' }) }
    finally { setDeleteId(null) }
  }

  const valueMap: Record<string, CharValueOption> = {}
  for (const v of charValues) valueMap[v.id] = v

  return (
    <div className="space-y-4">
      <Toaster toasts={toasts} onDismiss={dismiss} />
      <div className="flex justify-end">
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />{t('Add schedule')}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : allSchedules.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">{t('No modifier schedules yet.')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/30 text-muted-foreground">
                  <th className="text-left px-4 py-2">{t('Characteristic value')}</th>
                  <th className="text-left px-4 py-2">{t('Modifier')}</th>
                  <th className="text-left px-4 py-2">{t('Valid from')}</th>
                  <th className="text-left px-4 py-2">{t('Valid to')}</th>
                  <th className="text-left px-4 py-2">{t('Status')}</th>
                  <th className="px-4 py-2" />
                </tr></thead>
                <tbody>
                  {allSchedules.map(s => {
                    const cv = valueMap[s.characteristic_value_id]
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2">
                          <span className="font-medium">{cv?.label ?? s.characteristic_value_id}</span>
                          {cv && <span className="text-muted-foreground text-xs ml-1">({cv.charName})</span>}
                        </td>
                        <td className="px-4 py-2 font-medium">{Number(s.price_modifier) >= 0 ? '+' : ''}{Number(s.price_modifier).toFixed(2)}</td>
                        <td className="px-4 py-2">{fmtDate(s.valid_from)}</td>
                        <td className="px-4 py-2">{fmtDate(s.valid_to)}</td>
                        <td className="px-4 py-2"><ActiveBadge active={isActive(s.valid_from, s.valid_to)} /></td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('Edit modifier schedule') : t('New modifier schedule')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium">{t('Characteristic value')}</label>
              <Select value={form.characteristic_value_id} onChange={e => setForm(f => ({ ...f, characteristic_value_id: e.target.value }))} className="mt-1 w-full">
                <option value="">— {t('select')} —</option>
                {charValues.map(v => (
                  <option key={v.id} value={v.id}>{v.charName}: {v.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">{t('Price modifier (can be negative)')}</label>
              <Input type="number" step={0.01} value={form.price_modifier} onChange={e => setForm(f => ({ ...f, price_modifier: e.target.value }))} placeholder="0.00" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t('Valid from')}</label>
                <Input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">{t('Valid to')}</label>
                <Input type="date" value={form.valid_to} onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t('Note (optional)')}</label>
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder={t('e.g. Q3 promo')} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild><Button variant="outline">{t('Cancel')}</Button></DialogClose>
            <Button onClick={handleSave}>{t('Save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        title={t('Delete schedule')}
        description={t('Remove this modifier schedule?')}
        onConfirm={handleDelete}
        onOpenChange={open => { if (!open) setDeleteId(null) }}
      />
    </div>
  )
}

// ── Tax Rates tab ─────────────────────────────────────────────────────────────

function TaxRatesTab({ products, tenantId }: { products: Product[], tenantId: string }) {
  const { toasts, toast, dismiss } = useToast()
  const [presets, setPresets] = useState<ProductTaxPreset[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id ?? '')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProductTaxPreset | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ label: '', rate: '', valid_from: today(), valid_to: '' })

  const load = useCallback(async () => {
    if (!selectedProduct) return
    setLoading(true)
    try { setPresets(await fetchTaxPresets(selectedProduct)) }
    catch (e: any) { toast({ title: t('Error'), description: e.message, variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [selectedProduct])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    setForm({ label: '', rate: '', valid_from: today(), valid_to: '' })
    setDialogOpen(true)
  }

  function openEdit(p: ProductTaxPreset) {
    setEditing(p)
    setForm({ label: p.label, rate: String(p.rate), valid_from: p.valid_from, valid_to: p.valid_to ?? '' })
    setDialogOpen(true)
  }

  async function handleSave() {
    const rate = parseFloat(form.rate)
    if (isNaN(rate) || rate <= 0) { toast({ title: t('Rate must be > 0'), variant: 'destructive' }); return }
    if (!form.label.trim()) { toast({ title: t('Label is required'), variant: 'destructive' }); return }
    if (!form.valid_from) { toast({ title: t('Valid from is required'), variant: 'destructive' }); return }
    try {
      const row = {
        ...(editing ? { id: editing.id } : {}),
        tenant_id: tenantId,
        product_id: selectedProduct,
        label: form.label.trim(),
        rate,
        valid_from: form.valid_from,
        valid_to: form.valid_to || null,
      }
      await upsertTaxPreset(row as any)
      setDialogOpen(false)
      await load()
      toast({ title: editing ? t('Updated') : t('Created') })
    } catch (e: any) { toast({ title: t('Error'), description: e.message, variant: 'destructive' }) }
  }

  async function handleDelete() {
    if (!deleteId) return
    try { await deleteTaxPreset(deleteId); await load(); toast({ title: t('Deleted') }) }
    catch (e: any) { toast({ title: t('Error'), description: e.message, variant: 'destructive' }) }
    finally { setDeleteId(null) }
  }

  return (
    <div className="space-y-4">
      <Toaster toasts={toasts} onDismiss={dismiss} />
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="w-56">
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />{t('Add tax rate')}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : presets.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">{t('No tax rates yet.')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/30 text-muted-foreground">
                  <th className="text-left px-4 py-2">{t('Label')}</th>
                  <th className="text-left px-4 py-2">{t('Rate')}</th>
                  <th className="text-left px-4 py-2">{t('Valid from')}</th>
                  <th className="text-left px-4 py-2">{t('Valid to')}</th>
                  <th className="text-left px-4 py-2">{t('Status')}</th>
                  <th className="px-4 py-2" />
                </tr></thead>
                <tbody>
                  {presets.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2 font-medium">{p.label}</td>
                      <td className="px-4 py-2">{Number(p.rate).toFixed(2)}%</td>
                      <td className="px-4 py-2">{fmtDate(p.valid_from)}</td>
                      <td className="px-4 py-2">{fmtDate(p.valid_to)}</td>
                      <td className="px-4 py-2"><ActiveBadge active={isActive(p.valid_from, p.valid_to)} /></td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('Edit tax rate') : t('New tax rate')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium">{t('Label')}</label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. VAT 20%" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t('Rate (%)')}</label>
              <Input type="number" min={0.01} step={0.01} value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} placeholder="20" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t('Valid from')}</label>
                <Input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">{t('Valid to')}</label>
                <Input type="date" value={form.valid_to} onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))} className="mt-1" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild><Button variant="outline">{t('Cancel')}</Button></DialogClose>
            <Button onClick={handleSave}>{t('Save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        title={t('Delete tax rate')}
        description={t('Remove this tax rate preset?')}
        onConfirm={handleDelete}
        onOpenChange={open => { if (!open) setDeleteId(null) }}
      />
    </div>
  )
}

// ── Preset Adjustments tab ────────────────────────────────────────────────────

function AdjustmentPresetsTab({ products, tenantId }: { products: Product[], tenantId: string }) {
  const { toasts, toast, dismiss } = useToast()
  const [presets, setPresets] = useState<ProductAdjustmentPreset[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id ?? '')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProductAdjustmentPreset | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ label: '', adjustment_type: 'surcharge' as 'surcharge' | 'discount', mode: 'percent' as 'percent' | 'fixed', value: '', valid_from: today(), valid_to: '' })

  const load = useCallback(async () => {
    if (!selectedProduct) return
    setLoading(true)
    try { setPresets(await fetchAdjustmentPresets(selectedProduct)) }
    catch (e: any) { toast({ title: t('Error'), description: e.message, variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [selectedProduct])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    setForm({ label: '', adjustment_type: 'surcharge', mode: 'percent', value: '', valid_from: today(), valid_to: '' })
    setDialogOpen(true)
  }

  function openEdit(p: ProductAdjustmentPreset) {
    setEditing(p)
    setForm({ label: p.label, adjustment_type: p.adjustment_type, mode: p.mode, value: String(p.value), valid_from: p.valid_from, valid_to: p.valid_to ?? '' })
    setDialogOpen(true)
  }

  async function handleSave() {
    const val = parseFloat(form.value)
    if (isNaN(val) || val <= 0) { toast({ title: t('Value must be > 0'), variant: 'destructive' }); return }
    if (!form.label.trim()) { toast({ title: t('Label is required'), variant: 'destructive' }); return }
    if (!form.valid_from) { toast({ title: t('Valid from is required'), variant: 'destructive' }); return }
    try {
      const row = {
        ...(editing ? { id: editing.id } : {}),
        tenant_id: tenantId,
        product_id: selectedProduct,
        label: form.label.trim(),
        adjustment_type: form.adjustment_type,
        mode: form.mode,
        value: val,
        valid_from: form.valid_from,
        valid_to: form.valid_to || null,
      }
      await upsertAdjustmentPreset(row as any)
      setDialogOpen(false)
      await load()
      toast({ title: editing ? t('Updated') : t('Created') })
    } catch (e: any) { toast({ title: t('Error'), description: e.message, variant: 'destructive' }) }
  }

  async function handleDelete() {
    if (!deleteId) return
    try { await deleteAdjustmentPreset(deleteId); await load(); toast({ title: t('Deleted') }) }
    catch (e: any) { toast({ title: t('Error'), description: e.message, variant: 'destructive' }) }
    finally { setDeleteId(null) }
  }

  function fmtAdjValue(p: ProductAdjustmentPreset): string {
    const sign = p.adjustment_type === 'discount' ? '−' : '+'
    return p.mode === 'percent' ? `${sign}${Number(p.value).toFixed(2)}%` : `${sign}${Number(p.value).toFixed(2)}`
  }

  return (
    <div className="space-y-4">
      <Toaster toasts={toasts} onDismiss={dismiss} />
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="w-56">
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />{t('Add adjustment')}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : presets.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">{t('No preset adjustments yet.')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/30 text-muted-foreground">
                  <th className="text-left px-4 py-2">{t('Label')}</th>
                  <th className="text-left px-4 py-2">{t('Type')}</th>
                  <th className="text-left px-4 py-2">{t('Amount')}</th>
                  <th className="text-left px-4 py-2">{t('Valid from')}</th>
                  <th className="text-left px-4 py-2">{t('Valid to')}</th>
                  <th className="text-left px-4 py-2">{t('Status')}</th>
                  <th className="px-4 py-2" />
                </tr></thead>
                <tbody>
                  {presets.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2 font-medium">{p.label}</td>
                      <td className="px-4 py-2 capitalize">{p.adjustment_type}</td>
                      <td className="px-4 py-2">{fmtAdjValue(p)}</td>
                      <td className="px-4 py-2">{fmtDate(p.valid_from)}</td>
                      <td className="px-4 py-2">{fmtDate(p.valid_to)}</td>
                      <td className="px-4 py-2"><ActiveBadge active={isActive(p.valid_from, p.valid_to)} /></td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('Edit adjustment') : t('New preset adjustment')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium">{t('Label')}</label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder={t('e.g. Bulk discount')} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t('Type')}</label>
                <Select value={form.adjustment_type} onChange={e => setForm(f => ({ ...f, adjustment_type: e.target.value as 'surcharge' | 'discount' }))} className="mt-1 w-full">
                  <option value="discount">{t('Discount')}</option>
                  <option value="surcharge">{t('Surcharge')}</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">{t('Mode')}</label>
                <Select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value as 'percent' | 'fixed' }))} className="mt-1 w-full">
                  <option value="percent">{t('Percent (%)')}</option>
                  <option value="fixed">{t('Fixed amount')}</option>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t('Value')}</label>
              <Input type="number" min={0.01} step={0.01} value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder={form.mode === 'percent' ? '10' : '100.00'} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t('Valid from')}</label>
                <Input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">{t('Valid to')}</label>
                <Input type="date" value={form.valid_to} onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))} className="mt-1" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <DialogClose asChild><Button variant="outline">{t('Cancel')}</Button></DialogClose>
            <Button onClick={handleSave}>{t('Save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        title={t('Delete adjustment')}
        description={t('Remove this preset adjustment?')}
        onConfirm={handleDelete}
        onOpenChange={open => { if (!open) setDeleteId(null) }}
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PricingCenterPage() {
  const { tenant } = useAuthContext()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('base-prices')

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <PageHeader title={t('Pricing')} description={t('Manage scheduled prices, tax rates, and preset adjustments.')} />
        <p className="text-muted-foreground text-sm mt-6">{t('Create a product first before managing pricing schedules.')}</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 md:p-6 md:space-y-6">
      <PageHeader
        title={t('Pricing')}
        description={t('Set scheduled prices, modifier overrides, tax rates, and preset adjustments per product.')}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="base-prices">
            <CalendarRange className="h-3.5 w-3.5 mr-1.5" />{t('Base Prices')}
          </TabsTrigger>
          <TabsTrigger value="modifiers">
            <CalendarRange className="h-3.5 w-3.5 mr-1.5" />{t('Char. Modifiers')}
          </TabsTrigger>
          <TabsTrigger value="tax-rates">
            <CalendarRange className="h-3.5 w-3.5 mr-1.5" />{t('Tax Rates')}
          </TabsTrigger>
          <TabsTrigger value="adjustments">
            <CalendarRange className="h-3.5 w-3.5 mr-1.5" />{t('Preset Adjustments')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="base-prices" className="mt-4">
          <BasePricesTab products={products} tenantId={tenant?.id ?? ''} />
        </TabsContent>
        <TabsContent value="modifiers" className="mt-4">
          <ModifiersTab products={products} tenantId={tenant?.id ?? ''} />
        </TabsContent>
        <TabsContent value="tax-rates" className="mt-4">
          <TaxRatesTab products={products} tenantId={tenant?.id ?? ''} />
        </TabsContent>
        <TabsContent value="adjustments" className="mt-4">
          <AdjustmentPresetsTab products={products} tenantId={tenant?.id ?? ''} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
