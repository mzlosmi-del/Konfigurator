import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { t } from '@/i18n'
import type { TypeFilter } from './types'

interface LibraryToolbarProps {
  search: string
  onSearchChange: (v: string) => void
  typeFilter: TypeFilter
  onTypeFilterChange: (v: TypeFilter) => void
  onNewCharacteristic: () => void
  onNewClass: () => void
}

// Sticky toolbar above the master/detail panes: live search + display-type
// filter + the two create actions.
export function LibraryToolbar({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  onNewCharacteristic,
  onNewClass,
}: LibraryToolbarProps) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t('Search characteristics…')}
          className="pl-8"
        />
      </div>

      <Select
        value={typeFilter}
        onChange={e => onTypeFilterChange(e.target.value as TypeFilter)}
        className="w-40 shrink-0"
      >
        <option value="all">{t('Type: all')}</option>
        <option value="select">{t('Select')}</option>
        <option value="radio">{t('Radio')}</option>
        <option value="swatch">{t('Swatch')}</option>
        <option value="toggle">{t('Toggle')}</option>
        <option value="number">{t('Number')}</option>
        <option value="boolean">{t('Boolean')}</option>
      </Select>

      <Button size="sm" variant="outline" onClick={onNewCharacteristic} className="shrink-0">
        <Plus className="h-4 w-4 mr-1" />
        {t('New characteristic')}
      </Button>
      <Button size="sm" variant="outline" onClick={onNewClass} className="shrink-0">
        <Plus className="h-4 w-4 mr-1" />
        {t('New class')}
      </Button>
    </div>
  )
}
