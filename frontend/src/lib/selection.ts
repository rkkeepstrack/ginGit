import type { Commit } from './types'

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
  rows: readonly Pick<Commit, 'hash'>[],
  mods: ClickModifiers,
): { selected: Set<string>; anchor: number } {
  const hash = rows[index].hash
  if (mods.range && anchor !== null) {
    const [lo, hi] = anchor < index ? [anchor, index] : [index, anchor]
    const selected = mods.toggle ? new Set(current) : new Set<string>()
    for (const row of rows.slice(lo, hi + 1)) selected.add(row.hash)
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
