import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { applyClick, isContiguous, sortByPosition, type ClickModifiers } from '../lib/selection'
import type { Mode } from '../lib/types'
import { useRepo } from './repoStore'

interface SelectionState {
  selected: Set<string>
  anchor: number | null
  /** Hash the keyboard cursor sits on; usually the last clicked row. */
  cursor: number | null
  mode: Mode
  file: string | null

  click: (index: number, mods: ClickModifiers) => void
  moveCursor: (delta: number, extend: boolean, visible: readonly number[]) => void
  clear: () => void
  setMode: (m: Mode) => void
  setFile: (path: string | null) => void
}

export const useSelection = create<SelectionState>()((set, get) => ({
  selected: new Set(),
  anchor: null,
  cursor: null,
  mode: 'aggregate',
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
  setMode: (mode) => set({ mode, file: null }),
  setFile: (file) => set({ file }),
}))

/** Sorted hashes plus whether Range mode is allowed. Cheap enough to derive on every render. */
export function useSelectionInfo() {
  const selected = useSelection((s) => s.selected)
  const mode = useSelection((s) => s.mode)
  const { position, byHash } = useRepo(useShallow((s) => ({ position: s.position, byHash: s.byHash })))
  const hashes = sortByPosition(selected, position)
  const contiguous = isContiguous(hashes, byHash)
  const effectiveMode: Mode = mode === 'range' && !contiguous ? 'aggregate' : mode
  return { hashes, contiguous, mode: effectiveMode, count: hashes.length }
}
