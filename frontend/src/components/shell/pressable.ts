import type { KeyboardEvent } from 'react'

/** Makes a div behave like a button for keyboard users: focusable, Enter and Space activate it. */
export function pressable(onActivate: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate() }
    },
  }
}
