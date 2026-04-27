import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Eye, EyeOff, Package } from 'lucide-react'
import { useAuthContext } from '@/components/auth/AuthContext'
import { fetchProducts, deleteProduct, updateProduct } from '@/lib/products'
import { atLimit, isUnlimited, planLabel } from '@/lib/planLimits'
import type { Product } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'
import { t } from '@/i18n'

const statusVariant: Record<Product['status'], 'success' | 'warning' | 'secondary'> = {
  published: 'success',
  draft: 'warning',
  archived: 'secondary',
}

export function ProductsPage() {
  const navigate = useNavigate()
  const { tenant, planLimits } = useAuthContext()
  const { toasts, toast, dismiss } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [toDelete, setToDelete] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const maxProducts  = planLimits?.products_max ?? -1
  const overLimit    = atLimit(maxProducts, products.length)
  const unlimited    = isUnlimited(maxProducts)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      setProducts(await fetchProducts())
    } catch {
      toast({ title: t('Failed to load products'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteProduct(toDelete.id)
      setProducts(p => p.filter(x => x.id !== toDelete.id))
      toast({ title: t('Product deleted') })
      setToDelete(null)
    } catch {
      toast({ title: t('Delete failed'), variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  async function handleToggleStatus(product: Product) {
    const next = product.status === 'published' ? 'draft' : 'published'
    setToggling(product.id)
    try {
      const updated = await updateProduct(product.id, { status: next })
      setProducts(p => p.map(x => (x.id === (updated as Product).id ? (updated as Product) : x)))
      toast({ title: next === 'published' ? t('Product published') : t('Product unpublished') })
    } catch {
      toast({ title: t('Update failed'), variant: 'destructive' })
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('Products')}
        description={t('Manage your configurable products.')}
        action={
          <div className="flex items-center gap-3">
            {!loading && !unlimited && (
              <span className={`text-sm ${overLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                {products.length} / {maxProducts} &middot; {planLabel(tenant?.plan ?? 'free')}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => navigate('/products/import')} disabled={overLimit}>
              {t('Import CSV')}
            </Button>
            <div title={overLimit ? t('Upgrade your plan to add more products') : undefined}>
              <Button size="sm" onClick={() => navigate('/products/new')} disabled={overLimit}>
                <Plus className="h-4 w-4" /> {t('New product')}
              </Button>
            </div>
          </div>
        }
      />
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-sm">{t('No products yet')}</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                {t('Create your first configurable product to get started.')}
              </p>
              <Button size="sm" onClick={() => navigate('/products/new')}>
                <Plus className="h-4 w-4" /> {t('Create product')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('Name')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('Status')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('Base price')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground w-32">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map(product => (
                  <tr key={product.id} className="group hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium">{product.name}</span>
                      {product.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {product.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[product.status]} className="capitalize">
                        {t(product.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {product.base_price.toFixed(2)} {product.currency}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="icon"
                          title={product.status === 'published' ? t('Unpublish') : t('Publish')}
                          loading={toggling === product.id}
                          onClick={() => handleToggleStatus(product)}
                          disabled={product.status === 'archived'}
                        >
                          {product.status === 'published'
                            ? <EyeOff className="h-4 w-4" />
                            : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" title={t('Edit')}
                          onClick={() => navigate(`/products/${product.id}/edit`)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={t('Delete')}
                          className="text-destructive hover:text-destructive"
                          onClick={() => setToDelete(product)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
        title={t('Delete product?')}
        description={`"${toDelete?.name}" and all its data will be permanently deleted.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
