import type { Commit } from './types'

/** Orders hashes newest first by their position in the history. */
export function sortByPosition(hashes: Iterable<string>, position: Map<string, number>): string[] {
  return [...hashes]
    .filter((h) => position.has(h))
    .sort((a, b) => position.get(a)! - position.get(b)!)
}

/**
 * A selection is contiguous when, sorted newest first, each commit's first
 * parent is the next selected commit. Only then is a Range diff meaningful.
 */
export function isContiguous(sorted: string[], byHash: Map<string, Commit>): boolean {
  if (sorted.length === 0) return false
  for (let i = 0; i + 1 < sorted.length; i++) {
    const c = byHash.get(sorted[i])
    if (!c || c.parents[0] !== sorted[i + 1]) return false
  }
  return true
}

export interface ClickModifiers { toggle: boolean; range: boolean }

/**
 * Pure selection arithmetic, WebStorm-style:
 *  - plain click: select just this row and set the anchor
 *  - toggle (cmd/ctrl): flip this row, anchor moves here
 *  - range (shift): select everything between anchor and this row
 *  - range + toggle: add that span to the existing selection
 */
export function applyClick(
  current: Set<string>,
  anchor: number | null,
  index: number,
  rows: readonly string[],
  mods: ClickModifiers,
): { selected: Set<string>; anchor: number } {
  const hash = rows[index]
  if (mods.range && anchor !== null) {
    const [lo, hi] = anchor < index ? [anchor, index] : [index, anchor]
    const span = rows.slice(lo, hi + 1)
    const selected = mods.toggle ? new Set(current) : new Set<string>()
    for (const h of span) selected.add(h)
    return { selected, anchor }
  }
  if (mods.toggle) {
    const selected = new Set(current)
    if (selected.has(hash)) selected.delete(hash)
    else selected.add(hash)
    return { selected, anchor: index }
  }
  return { selected: new Set([hash]), anchor: index }
}
