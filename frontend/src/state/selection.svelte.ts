import { api } from '../lib/api'
import { plural } from '../lib/format'
import { applyClick, type ClickModifiers } from '../lib/selection'
import type { Ref } from '../lib/types'
import { positionOf, repo } from './repo.svelte'
import { search, setText } from './search.svelte'

/** Selected hashes newest first. Only commits present in the loaded history count. */
function sortedSelection(selected: Set<string>): string[] {
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
  /** The arrows only move the cursor until Enter opens it: set when they came over from the search. */
  browsing = $state(false)
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
  selection.browsing = false
}

/**
 * The arrow keys in the log. With a review open they select at once; in the
 * full-width log, or when they came over from the search, they only move the
 * cursor, to browse, and Enter opens it.
 * visible lists the commit indices a search left on screen; null means all.
 */
export function step(delta: number, extend: boolean, visible: readonly number[] | null) {
  const count = visible ? visible.length : repo.commits.length
  if (count === 0) return
  const cursor = selection.cursor
  const pos = cursor === null ? -1 : visible ? visible.indexOf(cursor) : cursor
  const next = visible ? visible[Math.max(0, Math.min(count - 1, pos + delta))] : Math.max(0, Math.min(count - 1, pos + delta))
  if (selection.hashes.length > 0 && !browsingHits()) click(next, { toggle: false, range: extend })
  else selection.cursor = next
}

// Browsing came from the search; once the search is gone, so is the browsing.
const browsingHits = () => selection.browsing && search.matches !== null

/** The arrows pressed in the search: they browse its hits until Enter opens one. */
export function browse(delta: number, visible: readonly number[] | null) {
  selection.browsing = true
  step(delta, false, visible)
}

/** Enter in the log: opens the commit the cursor browsed to. */
export function openCursor() {
  if (selection.cursor !== null && (browsingHits() || selection.hashes.length === 0)) click(selection.cursor, { toggle: false, range: false })
}

/** The log's keys, wherever they arrive: Enter opens what was browsed to, the arrows step. */
export function logKey(e: KeyboardEvent) {
  if (e.key === 'Enter') return openCursor()
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  e.preventDefault()
  step(e.key === 'ArrowDown' ? 1 : -1, e.shiftKey, search.matches)
}

export function clear() {
  selection.selected = new Set()
  selection.anchor = null
  selection.file = null
  selection.browsing = false
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
  selection.browsing = false
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
  return `Selected ${plural(hashes.length, 'commit')} on ${ref.name}`
}
