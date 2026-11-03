import { create } from 'zustand'
import { applyClick, sortByPosition, type ClickModifiers } from '../lib/selection'
import type { Mode } from '../lib/types'
import { useRepo } from './repoStore'

interface SelectionState {
  selected: Set<string>
  anchor: number | null
  /** Hash the keyboard cursor sits on; usually the last clicked row. */
  cursor: number | null
  file: string | null

  click: (index: number, mods: ClickModifiers) => void
  moveCursor: (delta: number, extend: boolean, visible: readonly number[]) => void
  clear: () => void
  setFile: (path: string | null) => void
}

export const useSelection = create<SelectionState>()((set, get) => ({
  selected: new Set(),
  anchor: null,
  cursor: null,
  file: null,

  click(index, mods) {
    const rows = useRepo.getState().commits
    const { selected, anchor } = applyClick(get().selected, get().anchor, index, rows.map((c) => c.hash), mods)
    set({ selected, anchor, cursor: index, file: null })
  },

  // visible is the list of commit indices currently shown (search may hide some).
  moveCursor(delta, extend, visible) {
    if (visible.length === 0) return
    const { cursor } = get()
    const pos = cursor === null ? -1 : visible.indexOf(cursor)
    const next = Math.max(0, Math.min(visible.length - 1, pos + delta))
    const index = visible[next]
    get().click(index, { toggle: false, range: extend })
  },

  clear: () => set({ selected: new Set(), anchor: null, file: null }),
  setFile: (file) => set({ file }),
}))

/** Sorted hashes of the selection. Every review is an aggregate of the selected commits' own changes. */
export function useSelectionInfo() {
  const selected = useSelection((s) => s.selected)
  const position = useRepo((s) => s.position)
  const hashes = sortByPosition(selected, position)
  const mode: Mode = 'aggregate'
  return { hashes, mode, count: hashes.length }
}
