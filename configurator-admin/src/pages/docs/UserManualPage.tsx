import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { t } from '@/i18n'
import { GettingStarted } from './chapters/GettingStarted'
import { ProductsChapter } from './chapters/ProductsChapter'
import { InquiriesQuotationsChapter } from './chapters/InquiriesQuotationsChapter'
import { SettingsChapter } from './chapters/SettingsChapter'
import { EmbedChapter } from './chapters/EmbedChapter'
import { PricingStub, LibraryStub, AnalyticsStub, AuditStub } from './chapters/StubChapters'

const TABS = [
  { id: 'getting-started', label: 'Getting started',           render: GettingStarted },
  { id: 'products',        label: 'Products & configuration',  render: ProductsChapter },
  { id: 'inquiries',       label: 'Inquiries & quotations',    render: InquiriesQuotationsChapter },
  { id: 'settings',        label: 'Branding, email, team, plan', render: SettingsChapter },
  { id: 'embed',           label: 'Embedding the widget',      render: EmbedChapter },
  { id: 'pricing',         label: 'Pricing center',            render: PricingStub },
  { id: 'library',         label: 'Library & texts',           render: LibraryStub },
  { id: 'analytics',       label: 'Analytics',                 render: AnalyticsStub },
  { id: 'audit',           label: 'Audit log',                 render: AuditStub },
] as const

type TabId = typeof TABS[number]['id']

function tabFromHash(): TabId {
  if (typeof window === 'undefined') return 'getting-started'
  const hash = window.location.hash.replace(/^#/, '')
  const match = TABS.find(x => x.id === hash)
  return (match?.id ?? 'getting-started') as TabId
}

export function UserManualPage() {
  const [tab, setTab] = useState<TabId>(tabFromHash())

  useEffect(() => {
    const handler = () => setTab(tabFromHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  function handleChange(next: string) {
    setTab(next as TabId)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${next}`)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('User manual')}
        description={t('How to set up products, handle inquiries, send quotations, and embed the widget.')}
        help={false}
      />

      <div className="px-4 sm:px-6 pt-4 max-w-3xl space-y-6 pb-12">
        <Tabs value={tab} onValueChange={handleChange}>
          <TabsList className="flex-wrap h-auto py-1">
            {TABS.map(({ id, label }) => (
              <TabsTrigger key={id} value={id}>{t(label)}</TabsTrigger>
            ))}
          </TabsList>

          {TABS.map(({ id, render: Render }) => (
            <TabsContent key={id} value={id} className="mt-6">
              <Render />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
