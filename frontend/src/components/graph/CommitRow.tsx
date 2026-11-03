import { memo } from 'react'
import { absoluteDate, relativeDate, shortHash } from '../../lib/format'
import type { Commit, Ref } from '../../lib/types'
import { LaneCell } from './LaneCell'
import { RefPills } from './RefPills'
import { DATE_W, HASH_W } from './columns'
import { conventionalPrefix } from '../../lib/color'
import { copyText } from '../../lib/clipboard'
import { hintProps, useHint } from '../../state/hintStore'

async function copyHash(hash: string) {
  const ok = await copyText(hash)
  useHint.getState().flashMessage(ok ? `Copied ${hash}` : 'Clipboard not available')
}

export const CommitRow = memo(function CommitRow({ commit, prev, refs, isHead, selected, graphWidth, authorWidth, onClick }: {
  commit: Commit
  prev: Commit | undefined
  refs: Ref[]
  isHead: boolean
  selected: boolean
  graphWidth: number
  authorWidth: number
  onClick: (e: React.MouseEvent) => void
}) {
  const isMerge = commit.parents.length > 1
  const conv = conventionalPrefix(commit.subject)
  return (
    <div
      className={`commit-row flex items-center ${selected ? 'selected' : ''}`}
      onMouseDown={(e) => { if (e.button === 0) onClick(e) }}
      data-hash={commit.hash}
    >
      <LaneCell row={commit.row} prev={prev?.row} isMerge={isMerge} isHead={isHead} width={graphWidth} />
      <div className={`flex-1 min-w-0 pl-1.5 pr-3 overflow-hidden text-ellipsis ${isMerge ? 'opacity-70' : ''}`} title={commit.subject}>
        <RefPills refs={refs} />
        {conv ? <><span className={`kind kind-${conv.kind}`}>{conv.prefix}</span> {conv.rest}</> : commit.subject}
      </div>
      <div className="shrink-0 overflow-hidden text-ellipsis pr-3 opacity-70" style={{ width: authorWidth }} title={`${commit.author} <${commit.authorEmail}>`}>
        {commit.author}
      </div>
      <div className="shrink-0 pr-3 opacity-55 text-right tabular-nums" style={{ width: DATE_W }} title={absoluteDate(commit.authorDate)}>
        {relativeDate(commit.authorDate)}
      </div>
      <div className="shrink-0 pr-2" style={{ width: HASH_W }}>
        <span
          className="hash-cell mono opacity-50"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); void copyHash(commit.hash) }}
          {...hintProps(`Click to copy ${commit.hash}`)}
        >
          {shortHash(commit.hash)}
        </span>
      </div>
    </div>
  )
})
