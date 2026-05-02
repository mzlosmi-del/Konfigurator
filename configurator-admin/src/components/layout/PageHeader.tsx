import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-5">
      <div className="space-y-0.5 min-w-0">
        <h1 className="text-lg font-semibold">{title}</h1>
        {description && (
          <div className="text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
