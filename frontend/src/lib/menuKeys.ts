import { closeDropdown } from './dom'

/**
 * `use:menuKeys` on a menu or a daisyUI dropdown around one: the arrow keys
 * walk its entries (from the trigger, too), Home and End jump to the ends, Esc
 * closes it. Esc stops here: the app's own Esc would clear the selection.
 * Moving the mouse moves the focus along, so pointer and keyboard never mark
 * two entries at once (see .menu in index.css).
 */
export function menuKeys(root: HTMLElement) {
  const onKey = (e: KeyboardEvent) => {
    const entries = [...root.querySelectorAll<HTMLElement>('li > button')]
    if (!entries.length) return
    const at = entries.indexOf(document.activeElement as HTMLElement)
    const go = (k: number) => {
      e.preventDefault()
      entries[(k + entries.length) % entries.length].focus()
    }
    if (e.key === 'ArrowDown') go(at + 1)
    else if (e.key === 'ArrowUp') go(at < 0 ? -1 : at - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(-1)
    else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closeDropdown()
    }
  }
  const onMove = (e: MouseEvent) => {
    const entry = (e.target as HTMLElement).closest<HTMLElement>('li > button')
    if (entry && root.contains(entry) && document.activeElement !== entry) entry.focus({ preventScroll: true })
  }
  root.addEventListener('keydown', onKey)
  root.addEventListener('mousemove', onMove)
  return {
    destroy: () => {
      root.removeEventListener('keydown', onKey)
      root.removeEventListener('mousemove', onMove)
    },
  }
}
