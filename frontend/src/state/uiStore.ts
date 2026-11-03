import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeChoice = 'system' | 'pastel' | 'dim'
export type DiffMode = 'unified' | 'split'

interface UIState {
  theme: ThemeChoice
  diffMode: DiffMode
  fileSort: 'name' | 'type'
  flatFiles: boolean
  columns: { author: number; date: number }
  setTheme: (t: ThemeChoice) => void
  cycleTheme: () => void
  setDiffMode: (m: DiffMode) => void
  toggleDiffMode: () => void
  setFileSort: (s: 'name' | 'type') => void
  setFlatFiles: (f: boolean) => void
  setColumn: (k: 'author' | 'date', w: number) => void
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      theme: 'system',
      diffMode: 'split',
      fileSort: 'name',
      flatFiles: false,
      columns: { author: 128, date: 64 },
      setTheme: (theme) => set({ theme }),
      cycleTheme: () =>
        set((s) => ({ theme: s.theme === 'system' ? 'pastel' : s.theme === 'pastel' ? 'dim' : 'system' })),
      setDiffMode: (diffMode) => set({ diffMode }),
      toggleDiffMode: () => set((s) => ({ diffMode: s.diffMode === 'split' ? 'unified' : 'split' })),
      setFileSort: (fileSort) => set({ fileSort }),
      setFlatFiles: (flatFiles) => set({ flatFiles }),
      setColumn: (k, w) => set((s) => ({ columns: { ...s.columns, [k]: Math.max(60, Math.min(400, w)) } })),
    }),
    { name: 'gingit-ui', version: 2 },
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
