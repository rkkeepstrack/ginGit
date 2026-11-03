/**
 * What the status bar says. A hover hint shows while the pointer rests on
 * something; a flash is a short confirmation ("Copied …") shown as a toast.
 */
class HintStore {
  hint = $state<string | null>(null)
  flash = $state<string | null>(null)
}

export const hints = new HintStore()

let timer: ReturnType<typeof setTimeout> | undefined

export function flashMessage(text: string, ms = 1800) {
  clearTimeout(timer)
  hints.flash = text
  timer = setTimeout(() => { hints.flash = null }, ms)
}

/** `use:hint={'text'}`: describes the element in the status bar while hovered. */
export function hint(node: HTMLElement, text: string) {
  let current = text
  const enter = () => { hints.hint = current }
  const leave = () => { if (hints.hint === current) hints.hint = null }
  node.addEventListener('mouseenter', enter)
  node.addEventListener('mouseleave', leave)
  return {
    update(next: string) { if (hints.hint === current) hints.hint = next; current = next },
    destroy() { node.removeEventListener('mouseenter', enter); node.removeEventListener('mouseleave', leave); leave() },
  }
}
