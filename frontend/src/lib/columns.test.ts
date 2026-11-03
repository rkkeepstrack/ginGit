import { describe, expect, it } from 'vitest'
import { fitColumns } from './columns'

describe('fitColumns', () => {
  it('keeps everything when there is room', () => {
    expect(fitColumns(1200, 60, 150)).toEqual({ author: 150, date: 72, hash: 64 })
  })
  it('shrinks the author first', () => {
    expect(fitColumns(60 + 360 + 64 + 72 + 100, 60, 150)).toEqual({ author: 100, date: 72, hash: 64 })
  })
  it('drops author, then date, then hash as the panel narrows', () => {
    expect(fitColumns(60 + 360 + 64 + 72 + 40, 60, 150)).toEqual({ author: 0, date: 72, hash: 64 })
    expect(fitColumns(60 + 360 + 64 + 30, 60, 150)).toEqual({ author: 0, date: 0, hash: 64 })
    expect(fitColumns(60 + 360 + 30, 60, 150)).toEqual({ author: 0, date: 0, hash: 0 })
    expect(fitColumns(200, 60, 150)).toEqual({ author: 0, date: 0, hash: 0 })
  })
})
