import { Navigate, Outlet } from 'react-router-dom'
import { useAuthContext } from './AuthContext'
import { FullPageSpinner } from '@/components/ui/spinner'

export function ProtectedRoute() {
  const { session, loading } = useAuthContext()

  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}
