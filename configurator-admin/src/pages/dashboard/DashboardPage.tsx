import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Inbox, TrendingUp, ArrowRight } from 'lucide-react'
import { useAuthContext } from '@/components/auth/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { fetchProducts } from '@/lib/products'
import { fetchInquiries } from '@/lib/inquiries'
import type { Product, Inquiry, InquiryStatus } from '@/types/database'
import { OnboardingChecklist } from '@/components/OnboardingChecklist'

const statusVariant: Record<InquiryStatus, 'destructive' | 'warning' | 'success' | 'secondary'> = {
  new: 'destructive',
  read: 'warning',
  replied: 'success',
  closed: 'secondary',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function DashboardPage() {
  const { tenant } = useAuthContext()
  const navigate = useNavigate()

  const [products, setProducts] = useState<Product[]>([])
  const [inquiries, setInquiries] = useState<(Inquiry & { product: { name: string } | null })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchProducts(), fetchInquiries()])
      .then(([p, i]) => {
        setProducts(p)
        setInquiries(i as any)
      })
      .finally(() => setLoading(false))
  }, [])

  const publishedCount = products.filter(p => p.status === 'published').length
  const newInquiries   = inquiries.filter(i => i.status === 'new').length
  const recentInquiries = inquiries.slice(0, 5)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Welcome${tenant?.name ? `, ${tenant.name}` : ''}`}
        description="Overview of your configurator activity."
      />

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <>
            {tenant && (
              <OnboardingChecklist products={products} tenantId={tenant.id} />
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                icon={Package}
                label="Published products"
                value={publishedCount}
                hint={`${products.length} total`}
                onClick={() => navigate('/products')}
              />
              <StatCard
                icon={Inbox}
                label="New inquiries"
                value={newInquiries}
                hint="Awaiting review"
                alert={newInquiries > 0}
                onClick={() => navigate('/inquiries')}
              />
              <StatCard
                icon={TrendingUp}
                label="Total inquiries"
                value={inquiries.length}
                hint="All time"
                onClick={() => navigate('/inquiries')}
              />
            </div>

            {/* Recent inquiries */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Recent inquiries</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => navigate('/inquiries')}
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </div>

              {recentInquiries.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <Inbox className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">No inquiries yet</p>
                    {products.length === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => navigate('/products/new')}
                      >
                        Create your first product
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-lg border bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody className="divide-y">
                      {recentInquiries.map(inq => (
                        <tr
                          key={inq.id}
                          className="hover:bg-muted/20 transition-colors cursor-pointer"
                          onClick={() => navigate(`/inquiries/${inq.id}`)}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium">{inq.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{inq.product?.name ?? '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {inq.total_price != null && (
                              <span className="tabular-nums text-sm">
                                {inq.total_price.toFixed(2)} {inq.currency}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Badge variant={statusVariant[inq.status]} className="capitalize">
                              {inq.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-muted-foreground w-24">
                            {timeAgo(inq.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  alert,
  onClick,
}: {
  icon: React.ElementType
  label: string
  value: number
  hint: string
  alert?: boolean
  onClick?: () => void
}) {
  return (
    <Card
      className={`cursor-pointer hover:border-primary/40 transition-colors ${alert ? 'border-destructive/40' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${alert ? 'text-destructive' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold tabular-nums ${alert ? 'text-destructive' : ''}`}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  )
}
