const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const sameYear = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const otherYear = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const full = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function shortHash(h: string): string {
  return h.slice(0, 7)
}

export function relativeDate(iso: string, now = Date.now()): string {
  const d = new Date(iso)
  const diff = (d.getTime() - now) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return 'just now'
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day')
  return d.getFullYear() === new Date(now).getFullYear() ? sameYear.format(d) : otherYear.format(d)
}

export function absoluteDate(iso: string): string {
  return full.format(new Date(iso))
}

export function formatCount(n: number): string {
  return n.toLocaleString()
}
