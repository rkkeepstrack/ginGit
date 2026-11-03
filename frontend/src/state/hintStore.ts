import { create } from 'zustand'

/**
 * What the status bar says. A hover hint shows while the pointer rests on
 * something; a flash is a short confirmation ("Copied …") that wins over the
 * hint for a moment.
 */
interface HintState {
  hint: string | null
  flash: string | null
  setHint: (h: string | null) => void
  flashMessage: (text: string, ms?: number) => void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useHint = create<HintState>()((set) => ({
  hint: null,
  flash: null,
  setHint: (hint) => set({ hint }),
  flashMessage: (text, ms = 1800) => {
    clearTimeout(timer)
    set({ flash: text })
    timer = setTimeout(() => set({ flash: null }), ms)
  },
}))

/** Spread onto an element to describe it in the status bar while hovered. */
export function hintProps(text: string) {
  return {
    onMouseEnter: () => useHint.getState().setHint(text),
    onMouseLeave: () => useHint.getState().setHint(null),
  }
}
