import type { Commit } from './types'

export const DATE_W = 72
export const HASH_W = 64
const AUTHOR_MIN = 72
const AUTHOR_MAX = 180
/** The subject column keeps at least this much before anything else may have space. */
const SUBJECT_MIN = 360

export interface Columns { author: number; date: number; hash: number }

/**
 * Fits the side columns into what's left after the graph and the subject's
 * minimum. The subject wins: author shrinks, then vanishes, then date, then
 * hash.
 */
export function fitColumns(panelWidth: number, graphWidth: number, authorFull: number): Columns {
  let spare = panelWidth - graphWidth - SUBJECT_MIN
  const cols: Columns = { author: 0, date: 0, hash: 0 }
  if (spare >= HASH_W) { cols.hash = HASH_W; spare -= HASH_W }
  if (spare >= DATE_W) { cols.date = DATE_W; spare -= DATE_W }
  if (spare >= authorFull) cols.author = authorFull
  else if (spare >= AUTHOR_MIN) cols.author = Math.floor(spare)
  return cols
}

let canvas: CanvasRenderingContext2D | null = null
function measure(text: string): number {
  if (!canvas) {
    canvas = document.createElement('canvas').getContext('2d')
    if (canvas) canvas.font = `13px ${getComputedStyle(document.body).fontFamily}`
  }
  return canvas ? canvas.measureText(text).width : text.length * 7
}

/** Author column width: fits the longest name in the history, within reason. */
export function authorWidth(commits: Commit[]): number {
  const seen = new Set<string>()
  let widest = 0
  for (const c of commits) {
    if (seen.has(c.author)) continue
    seen.add(c.author)
    widest = Math.max(widest, measure(c.author))
  }
  return Math.round(Math.min(AUTHOR_MAX, Math.max(AUTHOR_MIN, widest + 16)))
}
