import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  fetchAssignments,
  saveAssignment,
  deleteAssignment,
  type AssignmentRow,
  type AssignmentConditionInput,
} from '@/lib/assets'
import type { CharacteristicWithValues } from '@/lib/products'
import type { VisualizationAsset } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/useToast'

interface Props {
  productId: string
  chars: CharacteristicWithValues[]
  assets: VisualizationAsset[]
}

// Local draft row — `id: null` means unsaved. Conditions are keyed by
// characteristic id for easy cell editing; empty/absent = wildcard.
interface DraftRow {
  id: string | null
  asset_id: string
  priority: number
  cells: Record<string, AssignmentConditionInput> // characteristic_id -> condition
}

function toDraft(row: AssignmentRow): DraftRow {
  const cells: Record<string, AssignmentConditionInput> = {}
  for (const c of row.conditions) cells[c.characteristic_id] = c
  return { id: row.id, asset_id: row.asset_id, priority: row.priority, cells }
}

function draftConditions(d: DraftRow): AssignmentConditionInput[] {
  return Object.values(d.cells).filter(c =>
    (c.value_id !== null && c.value_id !== '') ||
    (c.numeric_value !== null && !Number.isNaN(c.numeric_value))
  )
}

export function AssignmentTableEditor({ productId, chars, assets }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<DraftRow[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)

  // Only 2D image/render assets can be targeted (3D uses mesh rules).
  const imageAssets = assets.filter(a => a.asset_type === 'image' || a.asset_type === 'render')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAssignments(productId)
      setRows(data.map(toDraft))
    } catch (e) {
      toast({ title: 'Failed to load assignment table', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [productId, toast])

  useEffect(() => { void load() }, [load])

  const addRow = () => {
    const nextPriority = rows.length === 0 ? 1 : Math.max(...rows.map(r => r.priority)) + 1
    setRows(prev => [...prev, {
      id: null,
      asset_id: imageAssets[0]?.id ?? '',
      priority: nextPriority,
      cells: {},
    }])
  }

  const updateRow = (idx: number, patch: Partial<DraftRow>) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))

  const updateCell = (idx: number, charId: string, patch: Partial<AssignmentConditionInput> | null) =>
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const cells = { ...r.cells }
      if (patch === null) { delete cells[charId]; return { ...r, cells } }
      const base: AssignmentConditionInput = cells[charId] ?? { characteristic_id: charId, operator: 'eq', value_id: null, numeric_value: null }
      cells[charId] = { ...base, ...patch }
      return { ...r, cells }
    }))

  const saveRow = async (idx: number) => {
    const d = rows[idx]
    if (!d.asset_id) { toast({ title: 'Pick an asset for the row', variant: 'destructive' }); return }
    setSavingId(d.id ?? `new-${idx}`)
    try {
      const newId = await saveAssignment(productId, {
        id: d.id,
        asset_id: d.asset_id,
        priority: d.priority,
        conditions: draftConditions(d),
      })
      updateRow(idx, { id: newId })
      toast({ title: 'Row saved' })
    } catch (e) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSavingId(null)
    }
  }

  const removeRow = async (idx: number) => {
    const d = rows[idx]
    if (d.id) {
      try { await deleteAssignment(d.id) }
      catch (e) { toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' }); return }
    }
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  if (loading) return <div className="py-6 flex justify-center"><Spinner /></div>

  if (imageAssets.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">Upload at least one image or render asset above to build an assignment table.</p>
  }

  const sorted = [...rows].sort((a, b) => a.priority - b.priority)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted text-left">
              <th className="p-2 border w-20">Priority</th>
              {chars.map(c => (
                <th key={c.id} className="p-2 border">
                  {c.name} <span className="text-muted-foreground font-normal">({c.display_type === 'number' ? 'numeric' : 'select'})</span>
                </th>
              ))}
              <th className="p-2 border">Asset</th>
              <th className="p-2 border w-24"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(d => {
              const idx = rows.indexOf(d)
              return (
                <tr key={d.id ?? `new-${idx}`}>
                  <td className="p-1 border">
                    <Input type="number" value={d.priority}
                      onChange={e => updateRow(idx, { priority: Number(e.target.value) })}
                      className="w-16" />
                  </td>
                  {chars.map(c => {
                    const cell = d.cells[c.id]
                    if (c.display_type === 'number') {
                      return (
                        <td key={c.id} className="p-1 border">
                          <div className="flex gap-1 items-center">
                            <Select
                              value={cell?.operator ?? 'eq'}
                              onChange={e => updateCell(idx, c.id, { operator: e.target.value as 'eq' | 'gt' | 'lt', value_id: null })}>
                              <option value="eq">=</option>
                              <option value="gt">&gt;</option>
                              <option value="lt">&lt;</option>
                            </Select>
                            <Input type="number" placeholder="any"
                              value={cell?.numeric_value ?? ''}
                              onChange={e => {
                                const v = e.target.value
                                updateCell(idx, c.id, v === '' ? null : { numeric_value: Number(v), value_id: null })
                              }}
                              className="w-20" />
                          </div>
                        </td>
                      )
                    }
                    return (
                      <td key={c.id} className="p-1 border">
                        <Select
                          value={cell?.value_id ?? ''}
                          onChange={e => {
                            const v = e.target.value
                            updateCell(idx, c.id, v === '' ? null : { value_id: v, operator: 'eq', numeric_value: null })
                          }}>
                          <option value="">— any —</option>
                          {c.characteristic_values.map(val => <option key={val.id} value={val.id}>{val.label}</option>)}
                        </Select>
                      </td>
                    )
                  })}
                  <td className="p-1 border">
                    <Select value={d.asset_id} onChange={e => updateRow(idx, { asset_id: e.target.value })}>
                      {imageAssets.map(a => (
                        <option key={a.id} value={a.id}>{a.url.split('/').pop()}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="p-1 border">
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => saveRow(idx)} disabled={savingId !== null}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => removeRow(idx)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" /> Add row</Button>
    </div>
  )
}
