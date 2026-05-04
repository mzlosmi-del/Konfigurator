import { Navigate, Outlet } from 'react-router-dom'
import { useAuthContext } from './AuthContext'
import { useCanView } from '@/hooks/usePermission'
import { FullPageSpinner } from '@/components/ui/spinner'

interface Props {
  functionality?: string
}

function FunctionalityGuard({ functionality }: { functionality: string }) {
  const canView = useCanView(functionality)
  if (!canView) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export function ProtectedRoute({ functionality }: Props) {
  const { session, loading } = useAuthContext()

  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace />

  if (functionality) return <FunctionalityGuard functionality={functionality} />

  return <Outlet />
}
