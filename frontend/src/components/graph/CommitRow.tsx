import { memo } from 'react'
import { absoluteDate, relativeDate, shortHash } from '../../lib/format'
import type { Commit, Ref } from '../../lib/types'
import { LaneCell } from './LaneCell'
import { RefPills } from './RefPills'

export const CommitRow = memo(function CommitRow({ commit, prev, refs, isHead, selected, graphWidth, columns, onClick }: {
  commit: Commit
  prev: Commit | undefined
  refs: Ref[]
  isHead: boolean
  selected: boolean
  graphWidth: number
  columns: { author: number; date: number }
  onClick: (e: React.MouseEvent) => void
}) {
  const isMerge = commit.parents.length > 1
  return (
    <div
      className={`commit-row flex items-center ${selected ? 'selected' : ''}`}
      onMouseDown={(e) => { if (e.button === 0) onClick(e) }}
      data-hash={commit.hash}
    >
      <LaneCell row={commit.row} prev={prev?.row} isMerge={isMerge} isHead={isHead} width={graphWidth} />
      <div className={`flex-1 min-w-0 pl-1.5 pr-3 overflow-hidden text-ellipsis ${isMerge ? 'opacity-70' : ''}`} title={commit.subject}>
        <RefPills refs={refs} />
        {commit.subject}
      </div>
      <div className="shrink-0 overflow-hidden text-ellipsis pr-3 opacity-65" style={{ width: columns.author }} title={`${commit.author} <${commit.authorEmail}>`}>
        {commit.author}
      </div>
      <div className="shrink-0 pr-3 opacity-55 text-right tabular-nums" style={{ width: columns.date }} title={absoluteDate(commit.authorDate)}>
        {relativeDate(commit.authorDate)}
      </div>
      <div className="shrink-0 w-[64px] mono opacity-50 pr-2">{shortHash(commit.hash)}</div>
    </div>
  )
})
