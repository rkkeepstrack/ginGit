import { describe, expect, it } from 'vitest'
import { abbreviatePath, plural, shortenPath } from './format'

describe('paths', () => {
  it('shortens home and keeps short paths whole', () => {
    expect(shortenPath('/Users/rakali/_pprojects/ginGit')).toBe('~/_pprojects/ginGit')
    expect(abbreviatePath('/Users/rakali/_pprojects/ginGit')).toBe('~/_pprojects/ginGit')
  })
  it('keeps head and tail of a long path', () => {
    const long = '/private/tmp/claude-501/-Users-rakali--pprojects/ed35c6af/scratchpad/bigrepo.git'
    const out = abbreviatePath(long, 40)
    expect(out.length).toBe(40)
    expect(out.startsWith('/private/tmp/')).toBe(true)
    expect(out.endsWith('bigrepo.git')).toBe(true)
    expect(out).toContain('…')
  })
})

it('plural', () => {
  expect(plural(1, 'file')).toBe('1 file')
  expect(plural(0, 'file')).toBe('0 files')
  expect(plural(2, 'match', 'matches')).toBe('2 matches')
})
