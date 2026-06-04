import { useState } from 'react'
import { Tag, Trash2 } from 'lucide-react'
import { I18nEditor } from '@/components/ui/i18n-editor'
import { Button } from '@/components/ui/button'
import type { CharacteristicClass } from '@/types/database'
import { t } from '@/i18n'

interface ClassDetailHeaderProps {
  cls: CharacteristicClass
  memberCount: number
  onRename: (id: string, name: string) => void
  onUpdateI18n: (id: string, i18n: Record<string, string>) => void
  onDelete: (cls: CharacteristicClass) => void
}

// Shown at the top of the right pane when a single class is selected. Holds the
// class-level actions (rename, translations, delete) that used to live on the
// class card, plus a hint that rows can be reordered here.
export function ClassDetailHeader({
  cls,
  memberCount,
  onRename,
  onUpdateI18n,
  onDelete,
}: ClassDetailHeaderProps) {
  const [editing, setEditing] = useState(false)
  const i18n = (cls.name_i18n as Record<string, string> | null) ?? {}

  return (
    <div className="mb-3 rounded-lg border bg-muted/10 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
        {editing ? (
          <input
            className="flex-1 text-sm font-semibold bg-transparent border-b border-primary outline-none min-w-0"
            defaultValue={cls.name}
            autoFocus
            onBlur={e => { onRename(cls.id, e.target.value); setEditing(false) }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
        ) : (
          <button
            type="button"
            className="flex-1 text-sm font-semibold text-left hover:text-primary transition-colors truncate"
            onClick={() => setEditing(true)}
            title={t('Click to rename')}
          >
            {cls.name}
          </button>
        )}
        <span className="text-xs text-muted-foreground shrink-0">
          {memberCount} {memberCount !== 1 ? t('characteristics') : t('characteristic')}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
          onClick={() => onDelete(cls)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <I18nEditor
        value={i18n}
        onChange={newI18n => onUpdateI18n(cls.id, newI18n)}
        placeholder={cls.name}
      />

      <p className="text-[11px] text-muted-foreground">
        {t('Drag rows to set the order characteristics appear in this class.')}
      </p>
    </div>
  )
}
