import { useMemo } from 'react'
import { create } from 'zustand'
import { applyClick, type ClickModifiers } from '../lib/selection'
import { positionOf, useRepo } from './repoStore'

interface SelectionState {
  selected: Set<string>
  anchor: number | null
  /** Row the keyboard cursor sits on; usually the last clicked row. */
  cursor: number | null
  file: string | null

  click: (index: number, mods: ClickModifiers) => void
  /** visible lists the commit indices currently shown (search may hide some). */
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
    const { selected, anchor } = applyClick(get().selected, get().anchor, index, useRepo.getState().commits, mods)
    set({ selected, anchor, cursor: index, file: null })
  },

  moveCursor(delta, extend, visible) {
    if (visible.length === 0) return
    const { cursor } = get()
    const pos = cursor === null ? -1 : visible.indexOf(cursor)
    const next = Math.max(0, Math.min(visible.length - 1, pos + delta))
    get().click(visible[next], { toggle: false, range: extend })
  },

  clear: () => set({ selected: new Set(), anchor: null, file: null }),
  setFile: (file) => set({ file }),
}))

/** Selected hashes newest first. Only commits present in the loaded history count. */
export function sortedSelection(selected: Set<string>): string[] {
  return [...selected]
    .filter((h) => positionOf(h) !== undefined)
    .sort((a, b) => positionOf(a)! - positionOf(b)!)
}

/** Memoised on the selection and the history, so effects can depend on it honestly. */
export function useSelectedHashes(): string[] {
  const selected = useSelection((s) => s.selected)
  const commits = useRepo((s) => s.commits)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => sortedSelection(selected), [selected, commits])
}
