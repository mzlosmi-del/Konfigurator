import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { CONTENT_LANGUAGES } from '@/lib/languages'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  value: Record<string, string>
  onChange: (v: Record<string, string>) => void
  multiline?: boolean
  placeholder?: string
}

export function I18nEditor({ value, onChange, multiline = false, placeholder }: Props) {
  const [adding, setAdding] = useState(false)
  const [newLang, setNewLang] = useState('')
  const [newText, setNewText] = useState('')

  const usedCodes = Object.keys(value)
  const availableLangs = CONTENT_LANGUAGES.filter(l => !usedCodes.includes(l.code))

  function handleBlur(code: string, text: string) {
    if (text.trim()) {
      onChange({ ...value, [code]: text.trim() })
    } else {
      const next = { ...value }
      delete next[code]
      onChange(next)
    }
  }

  function handleRemove(code: string) {
    const next = { ...value }
    delete next[code]
    onChange(next)
  }

  function handleAdd() {
    if (!newLang || !newText.trim()) return
    onChange({ ...value, [newLang]: newText.trim() })
    setNewLang('')
    setNewText('')
    setAdding(false)
  }

  return (
    <div className="space-y-1.5">
      {Object.entries(value).map(([code, text]) => (
        <div key={code} className="flex items-start gap-1.5">
          <span className="mt-1.5 inline-flex items-center justify-center w-7 h-5 rounded text-[10px] font-semibold bg-muted text-muted-foreground uppercase shrink-0">
            {code}
          </span>
          {multiline ? (
            <Textarea
              className="flex-1 text-sm"
              rows={2}
              key={`${code}-${text}`}
              defaultValue={text}
              placeholder={placeholder}
              onBlur={e => handleBlur(code, e.target.value)}
            />
          ) : (
            <Input
              className="flex-1 h-7 text-sm"
              key={`${code}-${text}`}
              defaultValue={text}
              placeholder={placeholder}
              onBlur={e => handleBlur(code, e.target.value)}
            />
          )}
          <button
            type="button"
            className="mt-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
            onClick={() => handleRemove(code)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="flex items-start gap-1.5">
          <select
            value={newLang}
            onChange={e => setNewLang(e.target.value)}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs shrink-0 w-36 focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          >
            <option value="">Language…</option>
            {availableLangs.map(l => (
              <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
            ))}
          </select>
          {multiline ? (
            <Textarea
              className="flex-1 text-sm"
              rows={2}
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder={placeholder}
            />
          ) : (
            <Input
              className="flex-1 h-7 text-sm"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder={placeholder}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
            />
          )}
          <button
            type="button"
            className="mt-1.5 text-primary hover:text-primary/80 disabled:text-muted-foreground transition-colors shrink-0"
            onClick={handleAdd}
            disabled={!newLang || !newText.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="mt-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            onClick={() => { setAdding(false); setNewLang(''); setNewText('') }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        availableLangs.length > 0 && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3 w-3" />
            Add translation
          </button>
        )
      )}
    </div>
  )
}
