import type { Commit } from '../../lib/types'

export const DATE_W = 64
export const HASH_W = 64
const AUTHOR_MIN = 72
const AUTHOR_MAX = 205

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
  // 25px for the avatar dot and its gap
  return Math.round(Math.min(AUTHOR_MAX, Math.max(AUTHOR_MIN, widest + 16 + 25)))
}
