import { useEffect, useState } from 'react'
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

    setState({
      session,
      user: session.user,
      profile,
      tenant,
      planLimits,
      loading: false,
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { ...state, signOut }
}
