import { Change, diff, presentableDiff } from '@codemirror/merge'

/** What happened to a line: kept, new, edited, only re-indented, or gone. */
export type LineKind = 'same' | 'inserted' | 'modified' | 'reindented' | 'deleted'

/** Two lines of a changed block belong together from this similarity on (0 to 1). */
const SIMILAR = 0.5
/** Beyond this many line pairs a block is not searched for similar lines; it stays one change. */
const MAX_PAIRS = 250_000

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
    // As IntelliJ does: inside the block, lines that resemble each other are a
    // change; what is left over is new on one side and gone on the other.
    const pairs = pairSimilar(linesA.slice(fa, ta), linesB.slice(fb, tb))
    if (!pairs) {
      kindsA.fill('modified', fa, ta)
      kindsB.fill('modified', fb, tb)
      return
    }
    kindsA.fill('deleted', fa, ta)
    kindsB.fill('inserted', fb, tb)
    for (const [i, j] of pairs) {
      kindsA[fa + i] = 'modified'
      kindsB[fb + j] = 'modified'
    }
  }
  // Which lines stay the same (up to whitespace), as IntelliJ finds them: lines
  // with letters or digits are matched first; a lone } or an empty line could
  // otherwise anchor two blocks at the wrong spot. Between two such anchors,
  // lines are paired by similarity, braces included, and the identical pairs
  // join the matches. What lies between two matches is a changed block.
  const matches: [number, number][] = []
  const exact = (fa: number, ta: number, fb: number, tb: number) => {
    let [x, y] = [fa, fb]
    for (const h of diff(sa.slice(fa, ta), sb.slice(fb, tb), { timeout: 1000 })) {
      while (x < fa + h.fromA) matches.push([x++, y++])
      ;[x, y] = [fa + h.toA, fb + h.toB]
    }
    while (x < ta) matches.push([x++, y++])
  }
  const gap = (fa: number, ta: number, fb: number, tb: number) => {
    if (fa === ta || fb === tb) return
    const pairs = pairSimilar(linesA.slice(fa, ta), linesB.slice(fb, tb))
    if (!pairs) return exact(fa, ta, fb, tb)
    for (const [x, y] of pairs) if (sa[fa + x] === sb[fb + y]) matches.push([fa + x, fb + y])
  }
  const worthy = (ls: string[]) => ls.flatMap((l, k) => (/[\p{L}\p{N}]/u.test(l) ? [k] : []))
  const [wa, wb] = [worthy(linesA), worthy(linesB)]
  const anchors: [number, number][] = []
  {
    const [ka, kb] = [wa.map((k) => sa[k]).join(''), wb.map((k) => sb[k]).join('')]
    let [x, y] = [0, 0]
    for (const h of diff(ka, kb, { timeout: 1000 })) {
      while (x < h.fromA) anchors.push([wa[x++], wb[y++]])
      ;[x, y] = [h.toA, h.toB]
    }
    while (x < wa.length) anchors.push([wa[x++], wb[y++]])
  }
  let [pa, pb] = [0, 0]
  for (const [x, y] of anchors) {
    gap(pa, x, pb, y)
    matches.push([x, y])
    ;[pa, pb] = [x + 1, y + 1]
  }
  gap(pa, linesA.length, pb, linesB.length)

  let [i, j] = [0, 0]
  for (const [x, y] of [...matches, [linesA.length, linesB.length] as [number, number]]) {
    if (x > i && y > j) rewritten(i, x, j, y)
    else if (y > j) {
      changes.push(new Change(offA[i], offA[i], offB[j], offB[y]))
      kindsB.fill('inserted', j, y)
    } else if (x > i) {
      changes.push(new Change(offA[i], offA[x], offB[j], offB[j]))
      kindsA.fill('deleted', i, x)
    }
    if (x < linesA.length) paired(x, x + 1, y)
    ;[i, j] = [x + 1, y + 1]
  }
  return { changes, kindsA, kindsB }
}

/**
 * The best ordered pairing of similar lines between two blocks (largest total
 * similarity), or null when the blocks are too big to search.
 */
function pairSimilar(a: string[], b: string[]): [number, number][] | null {
  const [n, m] = [a.length, b.length]
  if (n * m > MAX_PAIRS) return null
  const [ga, gb] = [a.map(grams), b.map(grams)]
  // Best = most total similarity; between equally similar pairings, the one
  // with more lines identical to the character, indentation included: every
  // } looks alike, the one at the same depth is the counterpart.
  const w = m + 1
  const score = new Float64Array((n + 1) * w)
  const exact = new Int32Array((n + 1) * w)
  const move = new Uint8Array((n + 1) * w) // 0: skip a line of a, 1: skip one of b, 2: pair them
  const better = (s: number, e: number, t: number, f: number) => s > t + 1e-9 || (s > t - 1e-9 && e > f)
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const [up, left, diag, here] = [(i - 1) * w + j, i * w + j - 1, (i - 1) * w + j - 1, i * w + j]
      let [s, e, mv] = [score[up], exact[up], 0]
      if (better(score[left], exact[left], s, e)) [s, e, mv] = [score[left], exact[left], 1]
      const sim = similarity(ga[i - 1], gb[j - 1])
      if (sim >= SIMILAR) {
        const [ps, pe] = [score[diag] + sim, exact[diag] + (a[i - 1] === b[j - 1] ? 1 : 0)]
        if (better(ps, pe, s, e)) [s, e, mv] = [ps, pe, 2]
      }
      ;[score[here], exact[here], move[here]] = [s, e, mv]
    }
  }
  const pairs: [number, number][] = []
  for (let [i, j] = [n, m]; i > 0 && j > 0; ) {
    const mv = move[i * w + j]
    if (mv === 0) i--
    else if (mv === 1) j--
    else pairs.push([--i, --j])
  }
  return pairs.reverse()
}

/** A line's content as a bag of character pairs, for comparing lines. */
function grams(line: string): Map<string, number> {
  const t = line.trim()
  const out = new Map<string, number>()
  if (t.length < 2) out.set(t, 1)
  for (let k = 0; k + 1 < t.length; k++) {
    const g = t.slice(k, k + 2)
    out.set(g, (out.get(g) ?? 0) + 1)
  }
  return out
}

/**
 * How alike two lines are, 0 to 1: the share of character pairs they have in
 * common. A line that grew (or shrank) counts too: when most of the shorter
 * one, at least a few characters of it, is found in the longer, it's an edit.
 */
function similarity(x: Map<string, number>, y: Map<string, number>): number {
  let common = 0
  let [sizeX, sizeY] = [0, 0]
  for (const [g, c] of x) {
    common += Math.min(c, y.get(g) ?? 0)
    sizeX += c
  }
  for (const c of y.values()) sizeY += c
  if (!sizeX && !sizeY) return 1
  const shared = (2 * common) / (sizeX + sizeY)
  const shorter = Math.min(sizeX, sizeY)
  return shorter >= 4 && common / shorter >= 0.8 ? Math.max(shared, SIMILAR) : shared
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
