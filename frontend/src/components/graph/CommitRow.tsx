import { memo } from 'react'
import { absoluteDate, relativeDate, shortHash } from '../../lib/format'
import { hasMod } from '../../lib/platform'
import type { Commit, Ref } from '../../lib/types'
import { conventionalPrefix } from '../../lib/color'
import { copyText } from '../../lib/clipboard'
import { hintProps, useHint } from '../../state/hintStore'
import { useSelection } from '../../state/selectionStore'
import { LaneCell, ROW_H } from './LaneCell'
import { RefPills } from './RefPills'
import type { Columns } from './columns'

async function copyHash(hash: string) {
  const ok = await copyText(hash)
  useHint.getState().flashMessage(ok ? `Copied ${hash.slice(0, 7)} to the clipboard` : 'Clipboard not available')
}

/** One history row. Everything it needs is a stable prop, so memo holds while scrolling. */
export const CommitRow = memo(function CommitRow({ index, commit, prev, refs, isHead, selected, graphWidth, columns, branch }: {
  index: number
  commit: Commit
  prev: Commit | undefined
  refs: Ref[]
  isHead: boolean
  selected: boolean
  graphWidth: number
  columns: Columns
  /** Set while a search filters the list: replaces the lanes with a badge. */
  branch?: string
}) {
  const isMerge = commit.parents.length > 1
  const conv = conventionalPrefix(commit.subject)
  return (
    <div
      className={`commit-row flex items-center ${selected ? 'selected' : ''}`}
      style={{ height: ROW_H, lineHeight: `${ROW_H}px` }}
      onMouseDown={(e) => { if (e.button === 0) useSelection.getState().click(index, { toggle: hasMod(e), range: e.shiftKey }) }}
      data-hash={commit.hash}
    >
      {branch === undefined
        ? <LaneCell row={commit.row} prev={prev?.row} isMerge={isMerge} isHead={isHead} width={graphWidth} />
        : <div className="shrink-0" style={{ width: graphWidth }} />}
      <div className={`flex-1 min-w-0 pl-1.5 pr-3 overflow-hidden text-ellipsis ${isMerge ? 'opacity-70' : ''}`} title={commit.subject}>
        {branch && !refs.some((r) => r.name === branch) && <span className="ref-pill name mr-2" title={`On ${branch}`}>{branch}</span>}
        <RefPills refs={refs} />
        {conv ? <><span className={`kind kind-${conv.kind}`}>{conv.prefix}</span> {conv.rest}</> : commit.subject}
      </div>
      {columns.author > 0 && (
        <div className="shrink-0 overflow-hidden text-ellipsis pr-3 opacity-70" style={{ width: columns.author }} title={`${commit.author} <${commit.authorEmail}>`}>
          {commit.author}
        </div>
      )}
      {columns.date > 0 && (
        <div className="shrink-0 pr-3 opacity-55 text-right tabular-nums" style={{ width: columns.date }} title={absoluteDate(commit.authorDate)}>
          {relativeDate(commit.authorDate)}
        </div>
      )}
      {columns.hash > 0 && (
        <div className="shrink-0 pr-2" style={{ width: columns.hash }}>
          <button
            type="button"
            className="hash-cell mono opacity-50"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); void copyHash(commit.hash) }}
            {...hintProps(`Click to copy ${commit.hash}`)}
          >
            {shortHash(commit.hash)}
          </button>
        </div>
      )}
    </div>
  )
})
