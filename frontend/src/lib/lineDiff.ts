import { Change, diff, presentableDiff } from '@codemirror/merge'

/** What happened to a line: kept, new, rewritten, only re-indented, or gone. */
export type LineKind = 'same' | 'inserted' | 'modified' | 'reindented' | 'deleted'

export interface Alignment {
  changes: readonly Change[]
  kindsA: LineKind[]
  kindsB: LineKind[]
}

/**
 * A line-first diff for the merge views, as IntelliJ does it. Lines are paired
 * by their content without leading and trailing whitespace, so code that only
 * moved one level deeper is still the same code: it shows as modified, with
 * its indentation highlighted, instead of as a deletion plus an insertion.
 * Between the paired lines, a run of only new lines is an insertion, a run of
 * only missing lines a deletion, a mix a modification; only modifications get
 * a character diff for their word highlights, and that one sees content only.
 *
 * CodeMirror's own diff is character based and happily matches a `}` or some
 * indentation across lines. Here every distinct trimmed line becomes one
 * character, so its fast diff over those strings is a line diff.
 */
export function alignLines(a: string, b: string): Alignment {
  const hit = recent.find((r) => r.a === a && r.b === b)
  if (hit) return hit.result
  const result = align(a, b)
  recent.unshift({ a, b, result })
  recent.length = Math.min(recent.length, 8)
  return result
}

/** The diffConfig.override for both merge views. */
export const lineDiff = (a: string, b: string) => alignLines(a, b).changes

// The views ask for the changes, then the component asks for the kinds of the same pair.
const recent: { a: string; b: string; result: Alignment }[] = []

function align(a: string, b: string): Alignment {
  const linesA = lines(a)
  const linesB = lines(b)
  const kindsA: LineKind[] = linesA.map(() => 'same')
  const kindsB: LineKind[] = linesB.map(() => 'same')
  const ids = new Map<string, number>()
  const encode = (ls: string[]) => {
    const chars: string[] = []
    for (const l of ls) {
      const key = l.trim()
      let id = ids.get(key)
      if (id === undefined) ids.set(key, (id = ids.size))
      chars.push(String.fromCharCode(id < 0xd800 ? id : id + 0x800)) // never a surrogate
    }
    return chars.join('')
  }
  const sa = encode(linesA)
  const sb = encode(linesB)
  if (ids.size > 0xffff - 0x800) {
    // More distinct lines than characters: let CodeMirror diff by characters.
    return { changes: presentableDiff(a, b), kindsA: linesA.map(() => 'modified'), kindsB: linesB.map(() => 'modified') }
  }
  const offA = offsets(linesA)
  const offB = offsets(linesB)
  const changes: Change[] = []

  // A whitespace difference, declared as small as it is. CodeMirror needs every
  // difference declared: it carries offsets from one side to the other across
  // the text between changes. Trimming the common end first puts an indent
  // change at the start of the line, where its cleanup won't stretch it over
  // the following word.
  const spacing = (fa: number, ta: number, fb: number, tb: number) => {
    const x = a.slice(fa, ta)
    const y = b.slice(fb, tb)
    if (x === y) return
    let end = 0
    while (end < x.length && end < y.length && x[x.length - 1 - end] === y[y.length - 1 - end]) end++
    let start = 0
    while (start < x.length - end && start < y.length - end && x[start] === y[start]) start++
    changes.push(new Change(fa + start, ta - end, fb + start, tb - end))
  }

  // Paired lines differ in whitespace at most: declare it, nothing else changed.
  const paired = (fa: number, ta: number, fb: number) => {
    for (let k = 0; k < ta - fa; k++) {
      const [x, y] = [fa + k, fb + k]
      if (linesA[x] === linesB[y]) continue
      const [sa, sb] = [shape(linesA[x], offA[x]), shape(linesB[y], offB[y])]
      spacing(sa.start, sa.from, sb.start, sb.from)
      spacing(sa.to, sa.end, sb.to, sb.end)
      kindsA[x] = 'reindented'
      kindsB[y] = 'reindented'
    }
  }

  // A rewritten block: the character diff runs on the lines' content only, so
  // it can't match indentation across lines. Its result is mapped back into
  // the documents, and the whitespace around each matched line break is
  // declared on its own.
  const rewritten = (fa: number, ta: number, fb: number, tb: number) => {
    const SA = linesA.slice(fa, ta).map((l, k) => shape(l, offA[fa + k]))
    const SB = linesB.slice(fb, tb).map((l, k) => shape(l, offB[fb + k]))
    const [ca, csA] = content(a, SA)
    const [cb, csB] = content(b, SB)
    const docA = (c: number) => { const k = lineOf(csA, c); return SA[k].from + c - csA[k] }
    const docB = (c: number) => { const k = lineOf(csB, c); return SB[k].from + c - csB[k] }
    // Unchanged content: its line breaks line up, the whitespace around them may not.
    const unchanged = (fromA: number, toA: number, fromB: number) => {
      for (let k = lineOf(csA, fromA); k < SA.length - 1; k++) {
        const br = csA[k] + SA[k].to - SA[k].from
        if (br < fromA) continue
        if (br >= toA) break
        const kb = lineOf(csB, fromB + br - fromA)
        spacing(SA[k].to, SA[k + 1].from, SB[kb].to, SB[kb + 1].from)
      }
    }
    spacing(SA[0].start, SA[0].from, SB[0].start, SB[0].from)
    let [pa, pb] = [0, 0]
    for (const c of presentableDiff(ca, cb)) {
      unchanged(pa, c.fromA, pb)
      changes.push(new Change(docA(c.fromA), docA(c.toA), docB(c.fromB), docB(c.toB)))
      ;[pa, pb] = [c.toA, c.toB]
    }
    unchanged(pa, ca.length, pb)
    const [la, lb] = [SA[SA.length - 1], SB[SB.length - 1]]
    spacing(la.to, la.end, lb.to, lb.end)
    kindsA.fill('modified', fa, ta)
    kindsB.fill('modified', fb, tb)
  }
  let i = 0
  let j = 0
  for (const h of diff(sa, sb, { timeout: 1000 })) {
    paired(i, h.fromA, j)
    if (h.fromA === h.toA) {
      changes.push(new Change(offA[h.fromA], offA[h.fromA], offB[h.fromB], offB[h.toB]))
      kindsB.fill('inserted', h.fromB, h.toB)
    } else if (h.fromB === h.toB) {
      changes.push(new Change(offA[h.fromA], offA[h.toA], offB[h.fromB], offB[h.fromB]))
      kindsA.fill('deleted', h.fromA, h.toA)
    } else {
      rewritten(h.fromA, h.toA, h.fromB, h.toB)
    }
    i = h.toA
    j = h.toB
  }
  paired(i, linesA.length, j)
  return { changes, kindsA, kindsB }
}

/** A line's place in its document: start, content start and end, end with its newline. */
interface Shape { start: number; from: number; to: number; end: number }

function shape(line: string, start: number): Shape {
  const from = start + line.length - line.trimStart().length
  return { start, from, to: from + line.trim().length, end: start + line.length }
}

/** The lines' content joined by single line breaks, and where each line starts in it. */
function content(doc: string, shapes: Shape[]): [string, number[]] {
  const starts: number[] = []
  let at = 0
  for (const s of shapes) {
    starts.push(at)
    at += s.to - s.from + 1
  }
  return [shapes.map((s) => doc.slice(s.from, s.to)).join('\n'), starts]
}

/** The line a position in the joined content belongs to: the last one starting at or before it. */
function lineOf(starts: number[], c: number): number {
  let [lo, hi] = [0, starts.length - 1]
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= c) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Lines with their newline, so equal lines are equal text, last line included. */
function lines(s: string): string[] {
  const out: string[] = []
  let at = 0
  while (at < s.length) {
    const nl = s.indexOf('\n', at)
    const end = nl < 0 ? s.length : nl + 1
    out.push(s.slice(at, end))
    at = end
  }
  return out
}

function offsets(ls: string[]): number[] {
  const out = [0]
  for (const l of ls) out.push(out[out.length - 1] + l.length)
  return out
}
