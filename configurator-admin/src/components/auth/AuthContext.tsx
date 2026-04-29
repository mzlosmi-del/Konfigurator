import { createContext, useContext, type ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile, Tenant } from '@/types/database'
import type { PlanLimits } from '@/lib/planLimits'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  tenant: Tenant | null
  planLimits: PlanLimits | null
  loading: boolean
  refreshTenant: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
