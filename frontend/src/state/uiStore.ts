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
  cycleTheme: () => void
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
      cycleTheme: () =>
        set((s) => ({ theme: s.theme === 'system' ? 'pastel' : s.theme === 'pastel' ? 'dim' : 'system' })),
      setDiffMode: (diffMode) => set({ diffMode }),
      toggleDiffMode: () => set((s) => ({ diffMode: s.diffMode === 'split' ? 'unified' : 'split' })),
      setFileSort: (fileSort) => set({ fileSort }),
      setFlatFiles: (flatFiles) => set({ flatFiles }),
    }),
    { name: 'gingit-ui', version: 3 },
  ),
)

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function resolvedTheme(choice: ThemeChoice): 'pastel' | 'dim' {
  if (choice !== 'system') return choice
  return media?.matches ? 'dim' : 'pastel'
}

export function applyTheme(choice: ThemeChoice) {
  document.documentElement.setAttribute('data-theme', resolvedTheme(choice))
}

export function watchSystemTheme() {
  media?.addEventListener('change', () => applyTheme(useUI.getState().theme))
}
