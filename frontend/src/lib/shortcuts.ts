import { hasMod } from './platform'

import type { Action } from './actions'

/** Maps a keydown to an app action, or null. Text inputs keep their keys. */
export function actionFor(e: KeyboardEvent): Action | null {
  const mod = hasMod(e)
  const target = e.target as HTMLElement | null
  const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  if (e.key === 'Escape') return 'escape'
  if (mod && !e.shiftKey && e.key.toLowerCase() === 'o') return 'open'
  if (mod && !e.shiftKey && e.key.toLowerCase() === 'r') return 'refresh'
  if (mod && !e.shiftKey && e.key.toLowerCase() === 'f') return 'find'
  if (mod && !e.shiftKey && e.key.toLowerCase() === 'p') return 'search'
  if (mod && e.shiftKey && e.key.toLowerCase() === 'd') return 'toggleDiff'
  if (mod && e.key === '1') return 'focusGraph'
  if (mod && e.key === '2') return 'focusDiff'
  if (mod && e.key === '3') return 'focusFiles'
  if (typing) return null
  if (e.key === '[' || (mod && e.key === 'ArrowUp')) return 'prevFile'
  if (e.key === ']' || (mod && e.key === 'ArrowDown')) return 'nextFile'
  return null
}
