import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { hasMod } from '../../lib/platform'
import { useRepo } from '../../state/repoStore'
import { useSearch } from '../../state/searchStore'
import { useSelection } from '../../state/selectionStore'
import { CommitRow } from './CommitRow'
import { GRAPH_PAD, LANE_W, MAX_LANES, ROW_H } from './LaneCell'
import { DATE_W, HASH_W, authorWidth } from './columns'
import { Notice } from '../shell/Notice'

const EMPTY: never[] = []

export function CommitList() {
  const { commits, refsByHash, head, maxLanes, loading, error } = useRepo(useShallow((s) => ({
    commits: s.commits, refsByHash: s.refsByHash, head: s.repo?.head, maxLanes: s.maxLanes, loading: s.loading, error: s.error,
  })))
  const matches = useSearch((s) => s.matches)
  const selected = useSelection((s) => s.selected)
  const click = useSelection((s) => s.click)
  const moveCursor = useSelection((s) => s.moveCursor)
  const authorW = useMemo(() => authorWidth(commits), [commits])

  // Row i of the list shows commit visible[i].
  const visible = useMemo(() => matches ?? EMPTY, [matches])
  const count = matches ? visible.length : commits.length
  const indexAt = useCallback((i: number) => (matches ? visible[i] : i), [matches, visible])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 20,
  })

  const graphWidth = GRAPH_PAD + Math.min(maxLanes, MAX_LANES) * LANE_W + 6

  // Keep the keyboard cursor in view.
  const cursor = useSelection((s) => s.cursor)
  useEffect(() => {
    if (cursor === null) return
    const row = matches ? visible.indexOf(cursor) : cursor
    if (row >= 0) virtualizer.scrollToIndex(row, { align: 'auto' })
  }, [cursor, matches, visible, virtualizer])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const all = matches ? visible : commits.map((_, i) => i)
    moveCursor(e.key === 'ArrowDown' ? 1 : -1, e.shiftKey, all)
  }

  return (
    <div className="flex flex-col h-full min-h-0" id="panel-graph">
      <div className="flex items-center h-8 col-head hairline-b shrink-0 overflow-hidden" style={{ scrollbarGutter: 'stable' }}>
        <div style={{ width: graphWidth }} className="shrink-0" />
        <div className="flex-1 pl-1.5">Commit</div>
        <div className="shrink-0" style={{ width: authorW }}>Author</div>
        <div className="shrink-0 text-right pr-3" style={{ width: DATE_W }}>Date</div>
        <div className="shrink-0" style={{ width: HASH_W }}>Hash</div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div ref={parentRef} className="flex-1 overflow-auto outline-none" style={{ scrollbarGutter: 'stable' }} tabIndex={0} onKeyDown={onKeyDown}>
        {count === 0 && !loading && !error && (
          <div className="p-6 text-center opacity-50">{matches ? 'No commits match.' : 'No commits.'}</div>
        )}
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => {
            const idx = indexAt(item.index)
            const c = commits[idx]
            if (!c) return null
            return (
              <div key={c.hash} style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${item.start}px)` }}>
                <CommitRow
                  commit={c}
                  prev={commits[idx - 1]}
                  refs={refsByHash.get(c.hash) ?? EMPTY}
                  isHead={c.hash === head}
                  selected={selected.has(c.hash)}
                  graphWidth={graphWidth}
                  authorWidth={authorW}
                  onClick={(e) => click(idx, { toggle: hasMod(e), range: e.shiftKey })}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
