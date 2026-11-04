const sameYear = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const otherYear = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short' })
const full = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function shortHash(h: string): string {
  return h.slice(0, 7)
}

/** Compact relative date for a narrow column: "now", "24 min", "21 h", "3 d", "Oct 18", then "Jan 2024". */
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

/** 812 B, 14.2 KB, 3.1 MB. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** "1 file", "2 files"; an irregular plural is passed in. */
export function plural(n: number, word: string, pluralForm = word + 's'): string {
  return `${n} ${n === 1 ? word : pluralForm}`
}

/** Home becomes ~; long paths keep their tail, which is the part that tells repos apart. */
export function shortenPath(p: string): string {
  const home = /^\/(?:Users|home)\/[^/]+/.exec(p)
  return home ? '~' + p.slice(home[0].length) : p
}

/** Keeps the start and the end of a long path, which is where it is recognisable. */
export function abbreviatePath(p: string, max = 44): string {
  const short = shortenPath(p)
  if (short.length <= max) return short
  const tail = Math.floor(max * 0.6)
  return short.slice(0, max - tail - 1) + '…' + short.slice(-tail)
}
