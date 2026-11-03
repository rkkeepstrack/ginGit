import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeChoice = 'system' | 'pastel' | 'dim'
export type DiffMode = 'unified' | 'split'

interface UIState {
  theme: ThemeChoice
  diffMode: DiffMode
  fileSort: 'name' | 'type'
  flatFiles: boolean
  setTheme: (t: ThemeChoice) => void
  setDiffMode: (m: DiffMode) => void
  toggleDiffMode: () => void
  setFileSort: (s: 'name' | 'type') => void
  setFlatFiles: (f: boolean) => void
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      theme: 'system',
      diffMode: 'split',
      fileSort: 'name',
      flatFiles: false,
      setTheme: (theme) => set({ theme }),
      setDiffMode: (diffMode) => set({ diffMode }),
      toggleDiffMode: () => set((s) => ({ diffMode: s.diffMode === 'split' ? 'unified' : 'split' })),
      setFileSort: (fileSort) => set({ fileSort }),
      setFlatFiles: (flatFiles) => set({ flatFiles }),
    }),
    { name: 'gingit-ui', version: 3 },
  ),
)

const dark = window.matchMedia('(prefers-color-scheme: dark)')

/**
 * Always sets an explicit data-theme: the app's own variables (lanes, diff
 * tints, brand) are defined per theme name, so "system" must resolve to one.
 */
export function applyTheme(choice: ThemeChoice) {
  const theme = choice === 'system' ? (dark.matches ? 'dim' : 'pastel') : choice
  document.documentElement.setAttribute('data-theme', theme)
}

/** Re-applies "system" when the OS switches. Call once. */
export function followSystemTheme() {
  dark.addEventListener('change', () => applyTheme(useUI.getState().theme))
}
