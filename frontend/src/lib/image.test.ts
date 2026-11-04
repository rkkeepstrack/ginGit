import { describe, expect, it } from 'vitest'
import { blobUrl, isImage } from './image'

describe('image', () => {
  it('knows raster images, not svg', () => {
    expect(isImage('assets/logo.PNG')).toBe(true)
    expect(isImage('a/b/shot.jpeg')).toBe(true)
    expect(isImage('icon.svg')).toBe(false)
    expect(isImage('notes.md')).toBe(false)
  })
  it('puts the file name after the hash', () => {
    expect(blobUrl('abc', 'assets/my logo.png')).toBe('/blob/abc/my%20logo.png')
  })
})
