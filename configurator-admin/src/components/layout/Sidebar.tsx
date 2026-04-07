import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Package, Inbox, Settings, LogOut, Boxes } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthContext } from '@/components/auth/AuthContext'
import { Separator } from '@/components/ui/separator'
import { useInquiryCounts } from '@/hooks/useInquiryCounts'

export function Sidebar() {
  const { tenant, signOut } = useAuthContext()
  const { newCount } = useInquiryCounts()

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', badge: 0 },
    { to: '/products',  icon: Package,         label: 'Products',  badge: 0 },
    { to: '/inquiries', icon: Inbox,            label: 'Inquiries', badge: newCount },
    { to: '/settings',  icon: Settings,         label: 'Settings',  badge: 0 },
  ]

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r bg-card">
      {/* Logo / brand */}
      <div className="flex h-14 items-center gap-2.5 px-4 border-b">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Boxes className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-sm truncate">
          {tenant?.name ?? 'Configurator'}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-2 pt-3">
        {navItems.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
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
            <span className="flex-1">{label}</span>
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
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
