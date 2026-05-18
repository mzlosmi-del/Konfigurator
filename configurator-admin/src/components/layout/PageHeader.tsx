import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { HelpCircle } from 'lucide-react'
import { t } from '@/i18n'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  action?: ReactNode
  /** Set to false to suppress the help (?) button (e.g. on the user manual itself). */
  help?: boolean
}

export function PageHeader({ title, description, action, help = true }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-5">
      <div className="space-y-0.5 min-w-0">
        <h1 className="text-lg font-semibold">{title}</h1>
        {description && (
          <div className="text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {action}
        {help && (
          <Link
            to="/docs/manual"
            title={t('User manual')}
            aria-label={t('User manual')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  )
}
