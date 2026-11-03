import { useMemo } from 'react'
import { create } from 'zustand'
import { api } from '../lib/api'
import { applyClick, type ClickModifiers } from '../lib/selection'
import type { Ref } from '../lib/types'
import { positionOf, useRepo } from './repoStore'

interface SelectionState {
  selected: Set<string>
  anchor: number | null
  /** Row the keyboard cursor sits on; usually the last clicked row. */
  cursor: number | null
  file: string | null
  /** Bumped when the list should scroll the cursor into a comfortable spot. */
  reveal: number

  click: (index: number, mods: ClickModifiers) => void
  /** visible lists the commit indices currently shown (search may hide some). */
  moveCursor: (delta: number, extend: boolean, visible: readonly number[]) => void
  selectMany: (hashes: string[], opts?: { reveal?: boolean }) => void
  clear: () => void
  setFile: (path: string | null) => void
}

export const useSelection = create<SelectionState>()((set, get) => ({
  selected: new Set(),
  anchor: null,
  cursor: null,
  file: null,
  reveal: 0,

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

  /** Replaces the selection; the cursor lands on the newest of them. */
  selectMany(hashes, opts = {}) {
    const positions = hashes.map(positionOf).filter((p): p is number => p !== undefined)
    const cursor = positions.length ? Math.min(...positions) : null
    set((s) => ({ selected: new Set(hashes), anchor: cursor, cursor, file: null, reveal: opts.reveal ? s.reveal + 1 : s.reveal }))
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

const MAX_BRANCH_SELECTION = 1000

/**
 * Selects the commits that belong to a branch or tag; too many is refused.
 * With reveal, the list scrolls to the branch tip. Returns what to tell the user.
 */
export async function selectBranch(ref: Ref, opts: { reveal?: boolean } = {}): Promise<string> {
  const repo = useRepo.getState().repo
  if (!repo) return ''
  const hashes = await api.branchCommits(repo.path, ref.full)
  if (hashes.length === 0) return `${ref.name} has no commits of its own`
  if (hashes.length > MAX_BRANCH_SELECTION) return `${ref.name} has ${hashes.length} commits, too many to review at once`
  useSelection.getState().selectMany(hashes, opts)
  return `Selected ${hashes.length} ${hashes.length === 1 ? 'commit' : 'commits'} on ${ref.name}`
}
