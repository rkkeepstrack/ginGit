import { GitCommitHorizontal } from 'lucide-react'
import { changeMark } from '../../lib/changeType'
import { shortHash } from '../../lib/format'
import type { DiffResult, Pair } from '../../lib/types'
import { commitOf } from '../../state/repoStore'
import type { DiffMode } from '../../state/uiStore'
import { Notice } from '../shell/Notice'
import { MergeViewHost } from './MergeViewHost'
import { SingleSideView } from './SingleSideView'

/** Renders a diff result: one pair, or several stacked with a note. */
export function DiffBody({ result, path, mode, stacked }: { result: DiffResult; path: string; mode: DiffMode; stacked: boolean }) {
  if (!result.stacked) return <PairView pair={result.pairs[0]} path={path} mode={mode} stacked={stacked} />
  return (
    <div className={stacked ? '' : 'flex-1 overflow-auto'}>
      <Notice kind="warning">{result.note}</Notice>
      {result.pairs.map((p) => (
        <div key={p.commit}>
          <div className="flex items-center gap-2 px-3 h-8 text-[12px] bg-base-200/60">
            <GitCommitHorizontal size={14} strokeWidth={1.75} className="opacity-50" />
            <span className="mono opacity-60">{shortHash(p.commit)}</span>
            <span className="truncate">{commitOf(p.commit)?.subject}</span>
            {changeMark[p.type] && <span className={`ct-${p.type} text-[11px] font-medium shrink-0`}>{changeMark[p.type]!.label}</span>}
          </div>
          <PairView pair={p} path={path} mode={mode} stacked />
        </div>
      ))}
    </div>
  )
}

function PairView({ pair, path, mode, stacked }: { pair: Pair; path: string; mode: DiffMode; stacked: boolean }) {
  const problem = pair.old.binary || pair.new.binary ? 'Binary file, no text diff.'
    : pair.old.tooLarge || pair.new.tooLarge ? 'File is larger than 2 MB, diff skipped.'
    : null
  if (problem) {
    return <div className={`${stacked ? 'p-3' : 'flex-1 flex items-center justify-center'} text-xs opacity-50`}>{problem}</div>
  }
  const oneSided = pair.old.missing !== pair.new.missing
  return (
    <div className={stacked ? '' : 'flex-1 min-h-0'}>
      {oneSided
        ? <SingleSideView text={pair.old.missing ? pair.new.content : pair.old.content} path={path} kind={pair.old.missing ? 'added' : 'deleted'} stacked={stacked} />
        : <MergeViewHost oldText={pair.old.content} newText={pair.new.content} path={path} mode={mode} stacked={stacked} />}
    </div>
  )
}
