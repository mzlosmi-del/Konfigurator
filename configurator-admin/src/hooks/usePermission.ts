import { useAuthContext } from '@/components/auth/AuthContext'
import type { PermLevel } from '@/types/database'

export function usePermission(functionality: string): PermLevel {
  const { profile, permissions } = useAuthContext()
  if (profile?.role === 'admin') return 'edit'
  return permissions[functionality] ?? 'none'
}

export function useCanView(functionality: string): boolean {
  return usePermission(functionality) !== 'none'
}

export function useCanEdit(functionality: string): boolean {
  return usePermission(functionality) === 'edit'
}
