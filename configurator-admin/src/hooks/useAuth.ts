import { useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile, Tenant } from '@/types/database'
import { fetchPlanLimits, type PlanLimits } from '@/lib/planLimits'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  tenant: Tenant | null
  planLimits: PlanLimits | null
  loading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    tenant: null,
    planLimits: null,
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
          setState({ session: null, user: null, profile: null, tenant: null, planLimits: null, loading: false })
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

    setState(s => ({
      ...s,
      session,
      user: session.user,
      profile,
      tenant,
      planLimits,
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
