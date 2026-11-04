import { api } from '../lib/api'
import { applyClick, type ClickModifiers } from '../lib/selection'
import type { Ref } from '../lib/types'
import { positionOf, repo } from './repo.svelte'
import { setText } from './search.svelte'

/** Selected hashes newest first. Only commits present in the loaded history count. */
export function sortedSelection(selected: Set<string>): string[] {
  return [...selected]
    .filter((h) => positionOf(h) !== undefined)
    .sort((a, b) => positionOf(a)! - positionOf(b)!)
}

class SelectionStore {
  selected = $state.raw<Set<string>>(new Set())
  anchor = $state<number | null>(null)
  /** Row the keyboard cursor sits on; usually the last clicked row. */
  cursor = $state<number | null>(null)
  /** File picked in the tree: the review scrolls to it. */
  file = $state<string | null>(null)
  /** Bumped when the list should scroll the cursor into a comfortable spot. */
  reveal = $state(0)
  /** Newest first; recomputed when the selection or the history changes. */
  hashes = $derived.by(() => { void repo.commits; return sortedSelection(this.selected) })
}

export const selection = new SelectionStore()

export function click(index: number, mods: ClickModifiers) {
  const { selected, anchor } = applyClick(selection.selected, selection.anchor, index, repo.commits, mods)
  selection.selected = selected
  selection.anchor = anchor
  selection.cursor = index
  selection.file = null
}

/** visible lists the commit indices currently shown (search may hide some). */
export function moveCursor(delta: number, extend: boolean, visible: readonly number[]) {
  if (visible.length === 0) return
  const pos = selection.cursor === null ? -1 : visible.indexOf(selection.cursor)
  const next = Math.max(0, Math.min(visible.length - 1, pos + delta))
  click(visible[next], { toggle: false, range: extend })
}

export function clear() {
  selection.selected = new Set()
  selection.anchor = null
  selection.file = null
}

export function setFile(path: string | null) {
  selection.file = path
}

/** Replaces the selection; the cursor lands on the newest of them. */
export function selectMany(hashes: string[], opts: { reveal?: boolean } = {}) {
  const positions = hashes.map(positionOf).filter((p): p is number => p !== undefined)
  const cursor = positions.length ? Math.min(...positions) : null
  selection.selected = new Set(hashes)
  selection.anchor = cursor
  selection.cursor = cursor
  selection.file = null
  if (opts.reveal) selection.reveal++
}

const MAX_BRANCH_SELECTION = 1000

/**
 * Selects the commits that belong to a branch or tag; too many is refused.
 * With reveal, the list scrolls to the branch tip. Returns what to tell the user.
 */
export async function selectBranch(ref: Ref, opts: { reveal?: boolean } = {}): Promise<string> {
  if (!repo.info) return ''
  const hashes = await api.branchCommits(repo.info.path, ref.full)
  if (hashes.length === 0) return `${ref.name} has no commits of its own`
  if (hashes.length > MAX_BRANCH_SELECTION) return `${ref.name} has ${hashes.length} commits, too many to review at once`
  // Leave the search in the same flush as the selection: the list's scroll
  // effect must see the full history, not the hits, when the cursor moves.
  setText('')
  selectMany(hashes, opts)
  return `Selected ${hashes.length} ${hashes.length === 1 ? 'commit' : 'commits'} on ${ref.name}`
}
