import type { ChangeType } from './types'

/** Marks for the change types worth pointing out; "modified" is the default and gets none. */
export const changeMark: Partial<Record<ChangeType, { letter: string; label: string }>> = {
  added: { letter: 'A', label: 'Added' },
  deleted: { letter: 'D', label: 'Deleted' },
  renamed: { letter: 'R', label: 'Renamed' },
}
