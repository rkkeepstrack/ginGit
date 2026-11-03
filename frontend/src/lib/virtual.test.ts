import { describe, expect, it } from 'vitest'
import { scrollTopFor, visibleRange } from './virtual'

describe('visibleRange', () => {
  it('covers the viewport plus overscan, clamped to the list', () => {
    expect(visibleRange(0, 280, 28, 1000, 5)).toEqual({ start: 0, end: 15 })
    expect(visibleRange(2800, 280, 28, 1000, 5)).toEqual({ start: 95, end: 115 })
    expect(visibleRange(27900, 280, 28, 1000, 5)).toEqual({ start: 991, end: 1000 })
    expect(visibleRange(0, 280, 28, 0)).toEqual({ start: 0, end: 0 })
  })
})

describe('scrollTopFor', () => {
  it('leaves a visible row alone in auto mode', () => {
    expect(scrollTopFor(12, 28, 280, 280, 'auto')).toBe(280)
  })
  it('scrolls the minimum when the row is outside', () => {
    expect(scrollTopFor(5, 28, 280, 280, 'auto')).toBe(140)
    expect(scrollTopFor(30, 28, 280, 280, 'auto')).toBe(30 * 28 + 28 - 280)
  })
  it('centres on request, never above the top', () => {
    expect(scrollTopFor(100, 28, 280, 0, 'center')).toBe(2800 - 126)
    expect(scrollTopFor(2, 28, 280, 0, 'center')).toBe(0)
  })
})
