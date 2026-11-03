import { describe, expect, it } from 'vitest'
import { applyClick } from './selection'

const rows = ['e', 'd', 'c', 'b', 'a'].map((hash) => ({ hash }))

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
