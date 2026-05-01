import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Package, Inbox, Settings, LogOut, Layers, FileText, AlignLeft, BarChart2, Code2, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/utils'
import { useAuthContext } from '@/components/auth/AuthContext'
import { Separator } from '@/components/ui/separator'
import { useInquiryCounts } from '@/hooks/useInquiryCounts'
import { t, getLang, setLang, LANGS, type Lang } from '@/i18n'

interface SidebarProps {
  mobileOpen?: boolean
  onClose?:    () => void
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const { signOut } = useAuthContext()
  const { newCount } = useInquiryCounts()
  const [lang, setLangState] = useState<Lang>(getLang())

  function handleLang(l: Lang) {
    setLang(l)
    setLangState(l)
  }

  const navItems = [
    { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',   badge: 0 },
    { to: '/products',   icon: Package,         label: 'Products',    badge: 0 },
    { to: '/library',    icon: Layers,          label: 'Library',     badge: 0 },
    { to: '/texts',      icon: AlignLeft,       label: 'Texts',       badge: 0 },
    { to: '/inquiries',  icon: Inbox,           label: 'Inquiries',   badge: newCount },
    { to: '/quotations', icon: FileText,        label: 'Quotations',  badge: 0 },
    { to: '/analytics',  icon: BarChart2,       label: 'Analytics',   badge: 0 },
    { to: '/embed-docs', icon: Code2,           label: 'Embed',       badge: 0 },
    { to: '/settings',   icon: Settings,        label: 'Settings',    badge: 0 },
  ]

  return (
    <aside
      className={cn(
        'flex flex-col bg-card border-r shrink-0',
        // Mobile: full-height fixed overlay that slides in from the left
        'fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-200 ease-in-out',
        // Desktop: back in document flow, standard sidebar width
        'md:relative md:inset-auto md:h-screen md:w-56 md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {/* Logo / brand */}
      <div className="flex h-14 items-center justify-between px-4 border-b">
        <Logo lockup="horizontal" size={28} />
        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-2 pt-3 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t(label)}</span>
            {badge > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-medium px-1">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-2">
        <Separator className="mb-2" />

        {/* Language switcher */}
        <div className="flex gap-1 px-3 py-1 mb-1">
          {LANGS.map(l => (
            <button
              key={l}
              type="button"
              onClick={() => handleLang(l)}
              className={cn(
                'flex-1 rounded px-2 py-0.5 text-xs font-medium transition-colors',
                lang === l
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {t('Sign out')}
        </button>
      </div>
    </aside>
  )
}
