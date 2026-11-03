const sameYear = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const otherYear = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const full = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function shortHash(h: string): string {
  return h.slice(0, 7)
}

/** Compact relative date for a narrow column: "now", "24 min", "21 h", "3 d", then a date. */
export function relativeDate(iso: string, now = Date.now()): string {
  const d = new Date(iso)
  const s = Math.max(0, (now - d.getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.round(s / 60)} min`
  if (s < 86400) return `${Math.round(s / 3600)} h`
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d`
  return d.getFullYear() === new Date(now).getFullYear() ? sameYear.format(d) : otherYear.format(d)
}

export function absoluteDate(iso: string): string {
  return full.format(new Date(iso))
}

export function formatCount(n: number): string {
  return n.toLocaleString()
}

/** Home becomes ~; long paths keep their tail, which is the part that tells repos apart. */
export function shortenPath(p: string): string {
  const home = /^\/(?:Users|home)\/[^/]+/.exec(p)
  return home ? '~' + p.slice(home[0].length) : p
}
