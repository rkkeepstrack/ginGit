/** Which fixed-height rows to render for a scroll position, with a margin either side. */
export function visibleRange(scrollTop: number, viewport: number, rowHeight: number, count: number, overscan = 10): { start: number; end: number } {
  if (count === 0 || viewport <= 0) return { start: 0, end: 0 }
  const first = Math.floor(scrollTop / rowHeight)
  const last = Math.ceil((scrollTop + viewport) / rowHeight)
  return { start: Math.max(0, first - overscan), end: Math.min(count, last + overscan) }
}

/** scrollTop that puts a row where asked; 'auto' moves as little as possible. */
export function scrollTopFor(index: number, rowHeight: number, viewport: number, current: number, align: 'auto' | 'center'): number {
  const top = index * rowHeight
  if (align === 'center') return Math.max(0, top - (viewport - rowHeight) / 2)
  if (top < current) return top
  if (top + rowHeight > current + viewport) return top + rowHeight - viewport
  return current
}
