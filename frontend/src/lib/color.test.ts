import { describe, expect, it } from 'vitest'
import { conventionalPrefix } from './color'

describe('color helpers', () => {
  it('parses conventional prefixes', () => {
    expect(conventionalPrefix('feat(LD-3360): add bullmq')).toEqual({ prefix: 'feat(LD-3360):', kind: 'feat', rest: 'add bullmq' })
    expect(conventionalPrefix('fix!: break')).toEqual({ prefix: 'fix!:', kind: 'fix', rest: 'break' })
    expect(conventionalPrefix('Merge pull request #3')).toBeNull()
    expect(conventionalPrefix('wip: thing')).toBeNull()
  })
})
