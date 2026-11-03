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

/** daisyUI follows the OS on its own when no data-theme is set. */
export function applyTheme(choice: ThemeChoice) {
  if (choice === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', choice)
}
