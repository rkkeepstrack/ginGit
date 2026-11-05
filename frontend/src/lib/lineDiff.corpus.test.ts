import { describe, expect, it } from 'vitest'
import { alignLines, lineDiff, type LineKind } from './lineDiff'

// Real changes from ginGit's own history, old and new. What the diff makes of
// each line is kept in a kinds.txt next to them: tuning the diff shows up as
// a reviewable change there, and `npx vitest -u` accepts it.
type Files = Record<string, string>
const olds = import.meta.glob('./diff-corpus/*/old.txt', { query: '?raw', import: 'default', eager: true }) as Files
const news = import.meta.glob('./diff-corpus/*/new.txt', { query: '?raw', import: 'default', eager: true }) as Files

const mark: Record<LineKind, string> = { same: ' ', inserted: '+', modified: '~', reindented: '>', deleted: '-' }

/** Every line the diff doesn't call the same: number, kind, text. */
function render(text: string, kinds: LineKind[]): string {
  return text
    .split('\n')
    .flatMap((line, k) => (kinds[k] && kinds[k] !== 'same' ? [`${String(k + 1).padStart(4)} ${mark[kinds[k]]} ${line.slice(0, 100)}`] : []))
    .join('\n')
}

describe('diff corpus', () => {
  for (const [path, a] of Object.entries(olds)) {
    const dir = path.slice(0, path.lastIndexOf('/'))
    it(dir.split('/').pop()!, async () => {
      const b = news[`${dir}/new.txt`]
      // CodeMirror's rule: changes in order, identical text between them.
      let [atA, atB] = [0, 0]
      for (const c of lineDiff(a, b)) {
        expect(a.slice(atA, c.fromA)).toBe(b.slice(atB, c.fromB))
        ;[atA, atB] = [c.toA, c.toB]
      }
      expect(a.slice(atA)).toBe(b.slice(atB))
      const { kindsA, kindsB } = alignLines(a, b)
      await expect(`old\n${render(a, kindsA)}\n\nnew\n${render(b, kindsB)}\n`).toMatchFileSnapshot(`${dir}/kinds.txt`)
    })
  }
})
