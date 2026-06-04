import type { Characteristic } from '@/types/database'

// The left-rail selection. 'all' and 'unassigned' are pinned special views;
// any other value is a class id.
export type LibraryView = 'all' | 'unassigned' | string

// Display-type filter in the toolbar. 'all' = no filter.
export type TypeFilter = 'all' | Characteristic['display_type']
