import { useState } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { parseMeshNames } from '@/lib/glbParser'
import type { CharacteristicWithValues } from '@/lib/products'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { t } from '@/i18n'

export type MeshVisibilityRule = {
  type: 'visibility'
  mesh_name: string
  value_id: string
}

export type MeshDimensionRule = {
  type: 'dimension'
  node_name: string
  characteristic_id: string
  axis: 'x' | 'y' | 'z'
  value_min: number
  value_max: number
  scale_min: number
  scale_max: number
}

export type MeshRule = MeshVisibilityRule | MeshDimensionRule

interface Props {
  assetId: string
  assetUrl: string
  initialRules: MeshRule[]
  initialMeshNames?: string[]
  characteristics: CharacteristicWithValues[]
  onSave: (rules: MeshRule[]) => Promise<void>
  onClose: () => void
}

const EMPTY_VIS_RULE: MeshVisibilityRule = { type: 'visibility', mesh_name: '', value_id: '' }
const EMPTY_DIM_RULE: MeshDimensionRule  = {
  type: 'dimension', node_name: '', characteristic_id: '',
  axis: 'y', value_min: 0, value_max: 100, scale_min: 0.5, scale_max: 2,
}

function asFloat(s: string, fallback: number): number {
  const n = parseFloat(s)
  return isNaN(n) ? fallback : n
}

export function MeshRulesEditor({ assetId: _assetId, assetUrl, initialRules, initialMeshNames = [], characteristics, onSave, onClose }: Props) {
  const [tab, setTab] = useState<'visibility' | 'dimension'>('visibility')
  const [rules, setRules] = useState<MeshRule[]>(initialRules)
  const [meshNames, setMeshNames] = useState<string[]>(initialMeshNames)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [saving, setSaving] = useState(false)

  const visRules = rules.filter((r): r is MeshVisibilityRule => r.type === 'visibility')
  const dimRules = rules.filter((r): r is MeshDimensionRule  => r.type === 'dimension')

  const numericChars = characteristics.filter(c =>
    c.display_type === 'number'
  )

  const allValues = characteristics.flatMap(c =>
    c.characteristic_values.map(v => ({ id: v.id, label: `${c.name} → ${v.label}` }))
  )

  async function handleParseMeshes() {
    setParsing(true)
    setParseError('')
    try {
      const names = await parseMeshNames(assetUrl)
      setMeshNames(names)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Failed to parse mesh names')
    } finally {
      setParsing(false)
    }
  }

  function updateVisRule(idx: number, patch: Partial<MeshVisibilityRule>) {
    const updated = visRules.map((r, i) => i === idx ? { ...r, ...patch } : r)
    setRules([...updated, ...dimRules])
  }

  function removeVisRule(idx: number) {
    setRules([...visRules.filter((_, i) => i !== idx), ...dimRules])
  }

  function addVisRule() {
    setRules([...visRules, { ...EMPTY_VIS_RULE }, ...dimRules])
  }

  function updateDimRule(idx: number, patch: Partial<MeshDimensionRule>) {
    const updated = dimRules.map((r, i) => i === idx ? { ...r, ...patch } : r)
    setRules([...visRules, ...updated])
  }

  function removeDimRule(idx: number) {
    setRules([...visRules, ...dimRules.filter((_, i) => i !== idx)])
  }

  function addDimRule() {
    setRules([...visRules, ...dimRules, { ...EMPTY_DIM_RULE }])
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(rules)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{t('Mesh rules')}</p>
        {/* Parse mesh names from the GLB file */}
        <button
          type="button"
          onClick={handleParseMeshes}
          disabled={parsing}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${parsing ? 'animate-spin' : ''}`} />
          {t('Load mesh names from model')}
        </button>
      </div>

      {parseError && (
        <p className="text-xs text-destructive">{parseError}</p>
      )}

      {meshNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {meshNames.map(n => (
            <span key={n} className="text-xs bg-muted border rounded px-2 py-0.5 font-mono">{n}</span>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 border-b pb-0">
        {(['visibility', 'dimension'] as const).map(tab_ => (
          <button
            key={tab_}
            type="button"
            onClick={() => setTab(tab_)}
            className={[
              'px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 -mb-px transition-colors',
              tab === tab_
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {tab_ === 'visibility' ? t('Visibility') : t('Dimensions')}
          </button>
        ))}
      </div>

      {tab === 'visibility' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t('Show a mesh only when a specific value is selected. Meshes not listed here are always visible.')}
          </p>

          {allValues.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              {t('No characteristic values found for this product. Add characteristics with values in the Characteristics tab first.')}
            </p>
          )}

          {visRules.length === 0 && allValues.length > 0 && (
            <p className="text-xs text-muted-foreground italic">{t('No visibility rules yet.')}</p>
          )}

          {visRules.map((rule, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">{t('Mesh name')}</label>
                {meshNames.length > 0 ? (
                  <Select
                    value={rule.mesh_name}
                    onChange={e => updateVisRule(idx, { mesh_name: e.target.value })}
                  >
                    <option value="">{t('Select mesh…')}</option>
                    {meshNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </Select>
                ) : (
                  <Input
                    placeholder={t('mesh name')}
                    value={rule.mesh_name}
                    onChange={e => updateVisRule(idx, { mesh_name: e.target.value })}
                    className="font-mono text-xs"
                  />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">{t('Show when value selected')}</label>
                <Select
                  value={rule.value_id}
                  onChange={e => updateVisRule(idx, { value_id: e.target.value })}
                >
                  <option value="">{t('Select value…')}</option>
                  {allValues.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                </Select>
              </div>
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                onClick={() => removeVisRule(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          <Button size="sm" variant="outline" onClick={addVisRule} disabled={allValues.length === 0} className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {t('Add visibility rule')}
          </Button>
        </div>
      )}

      {tab === 'dimension' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t('Scale a model node along an axis based on a numeric characteristic. Useful for width, height, depth.')}
          </p>

          {numericChars.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              {t('Add at least one numeric characteristic to this product to use dimension rules.')}
            </p>
          )}

          {dimRules.length === 0 && (
            <p className="text-xs text-muted-foreground italic">{t('No dimension rules yet.')}</p>
          )}

          {dimRules.map((rule, idx) => (
            <div key={idx} className="rounded-md border bg-background p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">{t('Node name')}</label>
                  {meshNames.length > 0 ? (
                    <Select
                      value={rule.node_name}
                      onChange={e => updateDimRule(idx, { node_name: e.target.value })}
                    >
                      <option value="">{t('Select node…')}</option>
                      {meshNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  ) : (
                    <Input
                      placeholder={t('node name')}
                      value={rule.node_name}
                      onChange={e => updateDimRule(idx, { node_name: e.target.value })}
                      className="font-mono text-xs"
                    />
                  )}
                </div>
                <div className="w-28 space-y-1">
                  <label className="text-xs text-muted-foreground">{t('Axis')}</label>
                  <Select
                    value={rule.axis}
                    onChange={e => updateDimRule(idx, { axis: e.target.value as 'x' | 'y' | 'z' })}
                  >
                    <option value="x">X (width)</option>
                    <option value="y">Y (height)</option>
                    <option value="z">Z (depth)</option>
                  </Select>
                </div>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0 mt-5"
                  onClick={() => removeDimRule(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('Characteristic')}</label>
                <Select
                  value={rule.characteristic_id}
                  onChange={e => updateDimRule(idx, { characteristic_id: e.target.value })}
                >
                  <option value="">{t('Select characteristic…')}</option>
                  {numericChars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('Value min')}</label>
                  <Input
                    type="number"
                    value={rule.value_min}
                    onChange={e => updateDimRule(idx, { value_min: asFloat(e.target.value, 0) })}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('Value max')}</label>
                  <Input
                    type="number"
                    value={rule.value_max}
                    onChange={e => updateDimRule(idx, { value_max: asFloat(e.target.value, 100) })}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('Scale min')}</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={rule.scale_min}
                    onChange={e => updateDimRule(idx, { scale_min: asFloat(e.target.value, 0.5) })}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('Scale max')}</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={rule.scale_max}
                    onChange={e => updateDimRule(idx, { scale_max: asFloat(e.target.value, 2) })}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          ))}

          {numericChars.length > 0 && (
            <Button size="sm" variant="outline" onClick={addDimRule} className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t('Add dimension rule')}
            </Button>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1 border-t">
        <Button size="sm" onClick={handleSave} loading={saving}>
          {t('Save mesh rules')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          {t('Close')}
        </Button>
      </div>
    </div>
  )
}
