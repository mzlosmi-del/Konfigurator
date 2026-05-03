import { useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { PermLevel, Profile, Tenant } from '@/types/database'
import { fetchPlanLimits, type PlanLimits } from '@/lib/planLimits'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  tenant: Tenant | null
  planLimits: PlanLimits | null
  permissions: Record<string, PermLevel>
  loading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    tenant: null,
    planLimits: null,
    permissions: {},
    loading: true,
  })

  // Keep a ref to current state so async callbacks always see fresh values
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadProfileAndTenant(session)
      } else {
        setState(s => ({ ...s, loading: false }))
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          loadProfileAndTenant(session)
        } else {
          setState({ session: null, user: null, profile: null, tenant: null, planLimits: null, permissions: {}, loading: false })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfileAndTenant(session: Session) {
    const { data: rawProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    const profile = rawProfile as Profile | null

    let tenant: Tenant | null = null
    if (profile?.tenant_id) {
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', profile.tenant_id)
        .single()
      tenant = data as Tenant | null
    }

    const planLimits = tenant ? await fetchPlanLimits(tenant.plan) : null

    // Load per-functionality permissions for non-admin roles
    const permissions: Record<string, PermLevel> = {}
    if (profile?.role && profile.role !== 'admin') {
      const { data: perms } = await supabase
        .from('role_permissions')
        .select('functionality, level')
        .eq('tenant_id', profile.tenant_id)
        .eq('role', profile.role)
      const rows = perms as { functionality: string; level: string }[] | null
      if (rows) {
        for (const p of rows) {
          permissions[p.functionality] = p.level as PermLevel
        }
      }
    }

    setState(s => ({
      ...s,
      session,
      user: session.user,
      profile,
      tenant,
      planLimits,
      permissions,
      loading: false,
    }))
  }

  async function refreshTenant() {
    const tenantId = stateRef.current.profile?.tenant_id
    if (!tenantId) return
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()
    if (data) setState(prev => ({ ...prev, tenant: data as Tenant }))
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { ...state, refreshTenant, signOut }
}
