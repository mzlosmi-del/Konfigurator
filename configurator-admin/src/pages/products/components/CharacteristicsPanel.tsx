import { useEffect, useState } from 'react'
import { Trash2, ChevronDown, ChevronRight, Tag } from 'lucide-react'
import {
  fetchClasses,
  fetchProductClassesWithChars,
  attachClassToProduct,
  detachClassFromProduct,
  type ProductClassWithChars,
} from '@/lib/products'
import type { CharacteristicClass } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toast'

interface Props {
  productId: string
}

export function CharacteristicsPanel({ productId }: Props) {
  const { toasts, toast, dismiss } = useToast()

  const [loading, setLoading]             = useState(true)
  const [assigned, setAssigned]           = useState<ProductClassWithChars[]>([])
  const [allClasses, setAllClasses]       = useState<CharacteristicClass[]>([])
  const [expanded, setExpanded]           = useState<Record<string, boolean>>({})
  const [selectedClassId, setSelectedClassId] = useState('')
  const [attaching, setAttaching]         = useState(false)
  const [toDetach, setToDetach]           = useState<ProductClassWithChars | null>(null)
  const [detaching, setDetaching]         = useState(false)

  useEffect(() => { load() }, [productId])

  async function load() {
    setLoading(true)
    try {
      const [assignedData, libData] = await Promise.all([
        fetchProductClassesWithChars(productId),
        fetchClasses(),
      ])
      setAssigned(assignedData)
      setAllClasses(libData)
      if (assignedData.length > 0) setExpanded({ [assignedData[0].id]: true })
    } catch {
      toast({ title: 'Failed to load classes', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const unassigned = allClasses.filter(c => !assigned.some(a => a.id === c.id))

  async function handleAttach() {
    if (!selectedClassId) return
    setAttaching(true)
    try {
      await attachClassToProduct(productId, selectedClassId, assigned.length)
      await load()
      setExpanded(prev => ({ ...prev, [selectedClassId]: true }))
      setSelectedClassId('')
    } catch {
      toast({ title: 'Failed to add class', variant: 'destructive' })
    } finally {
      setAttaching(false)
    }
  }

  async function handleDetach() {
    if (!toDetach) return
    setDetaching(true)
    try {
      await detachClassFromProduct(productId, toDetach.id)
      setAssigned(prev => prev.filter(a => a.id !== toDetach.id))
      setToDetach(null)
    } catch {
      toast({ title: 'Failed to remove class', variant: 'destructive' })
    } finally {
      setDetaching(false)
    }
  }

  function toggleExpand(classId: string) {
    setExpanded(prev => ({ ...prev, [classId]: !prev[classId] }))
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Spinner /></div>
  }

  return (
    <div className="space-y-4">

      {/* ── Assigned classes ──────────────────────────────────────────────── */}
      {assigned.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No classes assigned yet. Add a class below to define what customers can configure.
          {allClasses.length === 0 && (
            <> Go to the <span className="font-medium">Library</span> to create classes and characteristics first.</>
          )}
        </p>
      ) : (
        <div className="space-y-2">
          {assigned.map(cls => (
            <div key={cls.id} className="rounded-lg border bg-card overflow-hidden">
              {/* Header */}
              <div
                className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpand(cls.id)}
              >
                {expanded[cls.id]
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-sm flex-1">{cls.name}</span>
                <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">
                  {cls.characteristics.length} characteristic{cls.characteristics.length !== 1 ? 's' : ''}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive ml-1"
                  onClick={e => { e.stopPropagation(); setToDetach(cls) }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Characteristics list */}
              {expanded[cls.id] && (
                <div className="px-4 pb-3 pt-1 border-t bg-muted/10">
                  {cls.characteristics.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      No characteristics in this class yet. Add some in the Library.
                    </p>
                  ) : (
                    <div className="space-y-1 pt-1">
                      {cls.characteristics.map(char => (
                        <div
                          key={char.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm bg-background border"
                        >
                          <span className="flex-1 font-medium">{char.name}</span>
                          <span className="text-xs text-muted-foreground capitalize px-1.5 py-0.5 rounded bg-muted">
                            {char.display_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Add class ─────────────────────────────────────────────────────── */}
      {unassigned.length > 0 && (
        <div className="flex gap-2 items-center">
          <Select
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            className="flex-1"
          >
            <option value="">Add a class…</option>
            {unassigned.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAttach}
            disabled={!selectedClassId}
            loading={attaching}
          >
            Add
          </Button>
        </div>
      )}

      {unassigned.length === 0 && allClasses.length > 0 && assigned.length === allClasses.length && (
        <p className="text-xs text-muted-foreground">All library classes are already assigned to this product.</p>
      )}

      <ConfirmDialog
        open={!!toDetach}
        onOpenChange={open => !open && setToDetach(null)}
        title="Remove class from product?"
        description={`Remove class "${toDetach?.name}" from this product? The class and its characteristics remain in the Library.`}
        confirmLabel="Remove"
        onConfirm={handleDetach}
        loading={detaching}
      />

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
