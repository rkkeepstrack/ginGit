import { describe, expect, it } from 'vitest'
import { bucket, conventionalPrefix, initials } from './color'

describe('color helpers', () => {
  it('buckets deterministically within range', () => {
    expect(bucket('a@b.c')).toBe(bucket('a@b.c'))
    for (const s of ['', 'x', 'raphael@example.com', 'someone else']) {
      expect(bucket(s)).toBeGreaterThanOrEqual(0)
      expect(bucket(s)).toBeLessThan(8)
    }
  })
  it('builds initials', () => {
    expect(initials('Raphael Kalinowski')).toBe('RK')
    expect(initials('Julian')).toBe('JU')
    expect(initials('  ')).toBe('?')
    expect(initials('Jean Claude Van Damme')).toBe('JD')
  })
  it('parses conventional prefixes', () => {
    expect(conventionalPrefix('feat(LD-3360): add bullmq')).toEqual({ prefix: 'feat(LD-3360):', kind: 'feat', rest: 'add bullmq' })
    expect(conventionalPrefix('fix!: break')).toEqual({ prefix: 'fix!:', kind: 'fix', rest: 'break' })
    expect(conventionalPrefix('Merge pull request #3')).toBeNull()
    expect(conventionalPrefix('wip: thing')).toBeNull()
  })
})
