import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthContext } from '@/components/auth/AuthContext'
import {
  loadUiPreferences,
  saveTableLayout,
  clearTableLayout,
  mergeLayout,
  type TableLayout,
} from '@/lib/uiPreferences'

interface UseTableLayoutResult {
  layout:    TableLayout
  setLayout: (next: TableLayout) => void
  reset:     () => void
  loaded:    boolean
}

/**
 * Loads the user's saved layout for `tableKey` and merges it onto
 * `defaults`. Updates via setLayout are written back to the DB,
 * debounced ~500ms.
 *
 * Falls back to in-memory state if the user isn't loaded yet — first
 * write after auth catches up will persist.
 */
export function useTableLayout(tableKey: string, defaults: TableLayout): UseTableLayoutResult {
  const { user } = useAuthContext()
  const [layout, setLayoutState] = useState<TableLayout>(defaults)
  const [loaded, setLoaded]      = useState(false)
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load once when the user becomes available.
  useEffect(() => {
    let alive = true
    if (!user?.id) {
      setLoaded(false)
      return () => { alive = false }
    }
    loadUiPreferences(user.id)
      .then(prefs => {
        if (!alive) return
        setLayoutState(mergeLayout(defaults, prefs[tableKey]))
        setLoaded(true)
      })
      .catch(() => {
        if (!alive) return
        setLayoutState(defaults)
        setLoaded(true)
      })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tableKey])

  const setLayout = useCallback((next: TableLayout) => {
    setLayoutState(next)
    if (!user?.id) return
    if (writeTimer.current) clearTimeout(writeTimer.current)
    writeTimer.current = setTimeout(() => {
      saveTableLayout(user.id, tableKey, next).catch(() => {})
    }, 500)
  }, [user?.id, tableKey])

  const reset = useCallback(() => {
    setLayoutState(defaults)
    if (!user?.id) return
    if (writeTimer.current) clearTimeout(writeTimer.current)
    clearTableLayout(user.id, tableKey).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tableKey])

  return { layout, setLayout, reset, loaded }
}
