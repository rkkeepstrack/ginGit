import { describe, expect, it } from 'vitest'
import { applyClick, isContiguous, sortByPosition } from './selection'
import type { Commit } from './types'

const rows = ['e', 'd', 'c', 'b', 'a']

function commit(hash: string, parents: string[]): Commit {
  return { hash, parents, author: '', authorEmail: '', authorDate: '', commitDate: '', subject: '', row: { lane: 0, color: 0, segments: [], lanes: 1 } }
}

describe('applyClick', () => {
  it('plain click selects one and sets the anchor', () => {
    const r = applyClick(new Set(['a', 'b']), 4, 1, rows, { toggle: false, range: false })
    expect([...r.selected]).toEqual(['d'])
    expect(r.anchor).toBe(1)
  })
  it('toggle adds and removes', () => {
    let r = applyClick(new Set(['d']), 1, 3, rows, { toggle: true, range: false })
    expect([...r.selected].sort()).toEqual(['b', 'd'])
    r = applyClick(r.selected, r.anchor, 1, rows, { toggle: true, range: false })
    expect([...r.selected]).toEqual(['b'])
    expect(r.anchor).toBe(1)
  })
  it('shift selects the span from the anchor in either direction', () => {
    let r = applyClick(new Set(['d']), 1, 3, rows, { toggle: false, range: true })
    expect([...r.selected].sort()).toEqual(['b', 'c', 'd'])
    expect(r.anchor).toBe(1)
    r = applyClick(r.selected, r.anchor, 0, rows, { toggle: false, range: true })
    expect([...r.selected].sort()).toEqual(['d', 'e'])
  })
  it('shift without an anchor behaves like a click', () => {
    const r = applyClick(new Set(), null, 2, rows, { toggle: false, range: true })
    expect([...r.selected]).toEqual(['c'])
  })
  it('shift+toggle adds the span to the existing selection', () => {
    const r = applyClick(new Set(['e']), 3, 4, rows, { toggle: true, range: true })
    expect([...r.selected].sort()).toEqual(['a', 'b', 'e'])
  })
})

describe('contiguity', () => {
  const byHash = new Map<string, Commit>([
    ['e', commit('e', ['d'])],
    ['d', commit('d', ['c'])],
    ['c', commit('c', ['b', 'x'])],
    ['b', commit('b', ['a'])],
    ['a', commit('a', [])],
    ['x', commit('x', ['a'])],
  ])
  const position = new Map(['e', 'd', 'x', 'c', 'b', 'a'].map((h, i) => [h, i]))

  it('sorts newest first by position', () => {
    expect(sortByPosition(['a', 'e', 'c'], position)).toEqual(['e', 'c', 'a'])
    expect(sortByPosition(['zz', 'b'], position)).toEqual(['b'])
  })
  it('accepts first-parent chains', () => {
    expect(isContiguous(['e', 'd', 'c'], byHash)).toBe(true)
    expect(isContiguous(['c', 'b'], byHash)).toBe(true)
    expect(isContiguous(['c'], byHash)).toBe(true)
  })
  it('rejects gaps and second-parent links', () => {
    expect(isContiguous(['e', 'c'], byHash)).toBe(false)
    expect(isContiguous(['c', 'x'], byHash)).toBe(false)
    expect(isContiguous([], byHash)).toBe(false)
  })
})
