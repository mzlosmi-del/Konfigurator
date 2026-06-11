import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { NeonConfig, Characteristic } from '@/types/database'
import { NEON_FONTS } from '@/lib/neonFonts'
import { normalizeNeonConfig, DEFAULT_NEON_GLOW as DEFAULT_GLOW } from '@/lib/neonConfig'
import { t } from '@/i18n'

/** A colour-bearing sibling characteristic that can drive the neon glow. */
export interface ColorCharOption {
  id: string
  name: string
  display_type: Characteristic['display_type']
  /** value id → { label, hex } — for the per-value glow override map. */
  values: { id: string; label: string; hex_color: string | null }[]
}

interface Props {
  /** Current config (null ⇒ feature off). */
  config: NeonConfig | null
  /** Persist the whole config object (or null to turn the feature off). */
  onSave: (next: NeonConfig | null) => void
  /** Colour/swatch characteristics on this tenant that can be bound for the glow. */
  colorChars: ColorCharOption[]
}

/** Editor for a 'text' characteristic's live-neon-preview settings. Sits inside
 *  the expanded DraggableChar row. Turning the toggle off persists null so the
 *  widget renders a plain text field again (fully reversible, additive). */
export function NeonConfigEditor({ config, onSave, colorChars }: Props) {
  const enabled = config?.enabled === true

  // Local working copy so partial edits don't thrash the parent on every key.
  const [draft, setDraft] = useState<NeonConfig>(() => normalizeNeonConfig(config))

  function patch(p: Partial<NeonConfig>) {
    const next = { ...draft, ...p }
    setDraft(next)
    onSave(next)
  }

  function toggle(on: boolean) {
    if (!on) { onSave(null); setDraft(d => ({ ...d, enabled: false })); return }
    const next = { ...draft, enabled: true }
    setDraft(next)
    onSave(next)
  }

  const boundChar = colorChars.find(c => c.id === draft.colorCharId)

  return (
    <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/40 p-3 space-y-3">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          className="h-4 w-4 accent-fuchsia-600"
          checked={enabled}
          onChange={e => toggle(e.target.checked)}
        />
        <span className="text-sm font-medium">{t('Live neon preview')}</span>
      </label>

      {enabled && (
        <div className="space-y-3 pl-1">
          {/* Label override */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              {t('Input label')}
            </p>
            <Input
              className="h-8"
              placeholder={t('Your sign text')}
              defaultValue={draft.label ?? ''}
              onBlur={e => patch({ label: e.target.value.trim() || undefined })}
            />
          </div>

          {/* Max length */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              {t('Max length (characters)')}
            </p>
            <Input
              type="number"
              min={1}
              className="w-32 h-8"
              placeholder="30"
              defaultValue={draft.maxLength != null ? String(draft.maxLength) : ''}
              onBlur={e => {
                const v = e.target.value.trim()
                const n = v === '' ? null : parseInt(v, 10)
                patch({ maxLength: Number.isFinite(n as number) ? n : null })
              }}
            />
          </div>

          {/* Font multi-select (which fonts the customer may pick; first = default) */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              {t('Offered fonts')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {NEON_FONTS.map(f => {
                const on = draft.fonts.includes(f.key)
                return (
                  <button
                    key={f.key}
                    type="button"
                    className={[
                      'px-2.5 py-1 rounded-md border text-xs transition-colors',
                      on
                        ? 'border-fuchsia-500 bg-fuchsia-100 text-fuchsia-900'
                        : 'border-input bg-background text-muted-foreground hover:border-foreground',
                    ].join(' ')}
                    onClick={() => {
                      const fonts = on
                        ? draft.fonts.filter(k => k !== f.key)
                        : [...draft.fonts, f.key]
                      patch({ fonts })
                    }}
                  >
                    {f.family}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t('First selected font is the default. Pick at least one.')}
            </p>
          </div>

          {/* Glow colour source */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              {t('Glow colour from')}
            </p>
            <Select
              className="h-8"
              value={draft.colorCharId ?? ''}
              onChange={e => patch({ colorCharId: e.target.value || null })}
            >
              <option value="">{t('Fixed colour (below)')}</option>
              {colorChars.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>

          {/* Default / fallback glow colour */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              {t('Default glow colour')}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-8 w-12 rounded border border-input cursor-pointer"
                value={draft.defaultGlowHex || DEFAULT_GLOW}
                onChange={e => patch({ defaultGlowHex: e.target.value })}
              />
              <span className="text-xs font-mono text-muted-foreground">
                {draft.defaultGlowHex || DEFAULT_GLOW}
              </span>
            </div>
          </div>

          {/* Per-value glow override map — shown when a colour char is bound. */}
          {boundChar && boundChar.values.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                {t('Glow colour per option (optional)')}
              </p>
              <div className="space-y-1.5">
                {boundChar.values.map(v => {
                  const override = draft.glowColorMap?.[v.id]
                  const current = override || v.hex_color || draft.defaultGlowHex || DEFAULT_GLOW
                  return (
                    <div key={v.id} className="flex items-center gap-2">
                      <input
                        type="color"
                        className="h-7 w-10 rounded border border-input cursor-pointer"
                        value={current}
                        onChange={e => {
                          const map = { ...(draft.glowColorMap ?? {}) }
                          map[v.id] = e.target.value
                          patch({ glowColorMap: map })
                        }}
                      />
                      <span className="text-xs flex-1 truncate">{v.label}</span>
                      {override && (
                        <button
                          type="button"
                          className="text-[11px] text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            const map = { ...(draft.glowColorMap ?? {}) }
                            delete map[v.id]
                            patch({ glowColorMap: map })
                          }}
                        >
                          {t('Reset')}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('Falls back to the swatch colour, then the default glow colour.')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
