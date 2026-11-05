import { describe, expect, it } from 'vitest'
import { alignLines, lineDiff } from './lineDiff'

/**
 * Applies the changes to a, and checks what CodeMirror relies on: the changes
 * are in order and the text between two of them is identical on both sides.
 */
function apply(a: string, b: string) {
  const changes = lineDiff(a, b)
  let out = ''
  let [atA, atB] = [0, 0]
  for (const c of changes) {
    expect(c.fromA).toBeGreaterThanOrEqual(atA)
    expect(c.fromB).toBeGreaterThanOrEqual(atB)
    expect(a.slice(atA, c.fromA)).toBe(b.slice(atB, c.fromB))
    out += a.slice(atA, c.fromA) + b.slice(c.fromB, c.toB)
    ;[atA, atB] = [c.toA, c.toB]
  }
  expect(a.slice(atA)).toBe(b.slice(atB))
  return { changes, result: out + a.slice(atA) }
}

describe('lineDiff', () => {
  it('keeps identical lines out of an insertion, however tempting a } is', () => {
    const a = 'class Q {\n  close() {\n    q.close();\n  }\n\n  get() {\n    return q;\n  }\n}\n'
    const b = 'class Q {\n  close() {\n    q.close();\n    r.disconnect();\n  }\n\n  get() {\n    return q;\n  }\n}\n\nfunction expose() {\n  gauge.set();\n}\n'
    const { changes, result } = apply(a, b)
    expect(result).toBe(b)
    expect(changes.every((c) => c.fromA === c.toA)).toBe(true)
    expect(changes.map((c) => b.slice(c.fromB, c.toB))).toEqual(['    r.disconnect();\n', '\nfunction expose() {\n  gauge.set();\n}\n'])
  })
  it('diffs a rewritten line by characters', () => {
    const { changes, result } = apply('a\nx = 1\nb\n', 'a\nx = 2\nb\n')
    expect(result).toBe('a\nx = 2\nb\n')
    expect(changes).toHaveLength(1)
    expect([changes[0].fromA, changes[0].toA]).toEqual([6, 7])
  })
  it('handles a last line without newline', () => {
    expect(apply('x', 'x\ny').result).toBe('x\ny')
    expect(apply('x\ny', 'x').result).toBe('x')
    expect(apply('', 'new\n').result).toBe('new\n')
  })
})

describe('alignLines', () => {
  it('pairs code that only moved deeper, and calls the new wrapper new', () => {
    const a = 'start\nForEach(x) {\n  dot(x)\n}\nend\n'
    const b = 'start\nif plan {\n  route()\n} else {\n  ForEach(x) {\n    dot(x)\n  }\n}\nend\n'
    const { kindsA, kindsB } = alignLines(a, b)
    // the wrapper is new; the ForEach and its body are the old lines, re-indented
    expect(kindsB.slice(1, 4)).toEqual(['inserted', 'inserted', 'inserted'])
    expect(kindsB.slice(4, 6)).toEqual(['reindented', 'reindented'])
    expect(kindsA.slice(1, 3)).toEqual(['reindented', 'reindented'])
    // a lone } may pair with either closing brace; both readings are fine
  })
  it('marks removed lines deleted', () => {
    expect(alignLines('a\nb\nc\n', 'a\nc\n').kindsA).toEqual(['same', 'deleted', 'same'])
  })
  it('changes only the indentation of a re-indented line: the added spaces, at the line start', () => {
    const a = 'x\n  dot(x)\n'
    const b = 'x\n      dot(x)\n'
    const { changes, kindsB } = alignLines(a, b)
    expect(kindsB).toEqual(['same', 'reindented'])
    expect(changes.map((c) => [c.fromB, a.slice(c.fromA, c.toA), b.slice(c.fromB, c.toB)])).toEqual([[2, '', '    ']])
  })
  it('diffs a rewritten, re-indented block by content: no highlight lands in the indentation', () => {
    const a = 'body {\n  Stack {\n    List {\n      Row(a)\n    }\n  }\n}\n'
    const b = 'body {\n  List {\n    Pager(a)\n  }\n}\n'
    const { changes, result } = apply(a, b)
    expect(result).toBe(b)
    for (const c of changes) {
      const [x, y] = [a.slice(c.fromA, c.toA), b.slice(c.fromB, c.toB)]
      // a change is either content, or whitespace starting at a line start
      if (!(x + y).trim()) expect([c.fromA === 0 || a[c.fromA - 1] === '\n', c.fromB === 0 || b[c.fromB - 1] === '\n']).toContain(true)
    }
    expect(changes.some((c) => b.slice(c.fromB, c.toB).includes('Pager'))).toBe(true)
  })
  it('pairs an edited line with its old self; a line with nothing like it is new, its old one gone', () => {
    const a = 'start\nlet total = price * count\nreturn old()\nend\n'
    const b = 'start\nlet total = price * amount\nvar cards = vehicles.map(card)\nend\n'
    const { kindsA, kindsB } = alignLines(a, b)
    expect(kindsB.slice(1, 3)).toEqual(['modified', 'inserted'])
    expect(kindsA.slice(1, 3)).toEqual(['modified', 'deleted'])
  })
  it('splits a changed block into new, changed and gone lines by similarity', () => {
    const a = 'body {\n  HStack {\n    Text(vehicle.name).font(.headline)\n  }\n}\n'
    const b = 'body {\n  VStack(alignment: .leading) {\n    Divider().padding(16)\n    Stat(label: battery)\n    Text(vehicle.name).font(.title2)\n  }\n}\n'
    const { kindsA, kindsB } = alignLines(a, b)
    // the text line found its counterpart; the stack line has none, and the new lines are new
    expect(kindsB.slice(1, 5)).toEqual(['inserted', 'inserted', 'inserted', 'modified'])
    expect(kindsA.slice(1, 3)).toEqual(['deleted', 'modified'])
  })
  it('counts a line that grew as changed, not as gone and new', () => {
    const { kindsA, kindsB } = alignLines('# Usage\n\nRun it.\n', '# Usage\n\nRun it. Then run it again.\n')
    expect(kindsA[2]).toBe('modified')
    expect(kindsB[2]).toBe('modified')
  })
})
