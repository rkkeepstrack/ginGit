import { ChevronDown, ChevronUp, FileDiff, GitCommitHorizontal, LayoutList } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ApiError, api } from '../../lib/api'
import { shortHash } from '../../lib/format'
import type { ChangeType, DiffResult, Pair } from '../../lib/types'
import { useRepo } from '../../state/repoStore'
import { useSelection, useSelectionInfo } from '../../state/selectionStore'
import { useUI } from '../../state/uiStore'
import { Notice } from '../shell/Notice'
import { useChanges } from '../../state/changesStore'
import { AllFilesView } from './AllFilesView'
import { MergeViewHost } from './MergeViewHost'

export const typeLabel: Record<ChangeType, string> = { added: 'Added', modified: 'Modified', deleted: 'Deleted', renamed: 'Renamed' }

export function stepFile(delta: number) {
  const { file, setFile } = useSelection.getState()
  const paths = useChanges.getState().paths
  if (paths.length === 0) return
  const i = file ? paths.indexOf(file) : -1
  const next = i < 0 ? (delta > 0 ? 0 : paths.length - 1) : Math.max(0, Math.min(paths.length - 1, i + delta))
  setFile(paths[next])
}

export function DiffPanel() {
  const repoPath = useRepo((s) => s.repo?.path)
  const { hashes, mode } = useSelectionInfo()
  const file = useSelection((s) => s.file)
  const diffMode = useUI((s) => s.diffMode)
  const [result, setResult] = useState<DiffResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const key = hashes.join(',') + '|' + mode + '|' + file
  useEffect(() => {
    if (!repoPath || !file || hashes.length === 0) {
      setResult(null)
      setError(null)
      return
    }
    let alive = true
    setLoading(true)
    api.fileDiff(repoPath, hashes, mode, file).then(
      (r) => { if (alive) { setResult(r); setError(null); setLoading(false) } },
      (e: ApiError) => { if (alive) { setError(e.display); setResult(null); setLoading(false) } },
    )
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath, key])

  const paths = useChanges((s) => s.paths)
  const changeSet = useChanges((s) => s.changeSet)
  const idx = file ? paths.indexOf(file) : -1

  if (!file) {
    if (hashes.length > 0 && changeSet && changeSet.files.length > 0) {
      return <AllFilesView key={key} changeSet={changeSet} paths={paths} hashes={hashes} mode={mode} diffMode={diffMode} />
    }
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-[12.5px] opacity-40 select-none" id="panel-diff">
        <FileDiff size={28} strokeWidth={1.25} />
        {hashes.length === 0 ? 'Select commits to review their changes' : 'No file changes'}
      </div>
    )
  }

  const segments = file.split('/')
  return (
    <div className="flex flex-col h-full min-h-0" id="panel-diff">
      <div className="panel-head hairline-b">
        {result && <span className={`ct-${result.type} text-[11px] font-medium shrink-0`}>{typeLabel[result.type]}</span>}
        <span className="truncate select-text" title={file}>
          {segments.map((s, i) => (
            <span key={i} className={i === segments.length - 1 ? '' : 'opacity-50'}>{s}{i < segments.length - 1 ? '/' : ''}</span>
          ))}
        </span>
        {result && !result.stacked && result.pairs[0] && (
          <span className="opacity-50 shrink-0" title="Old commit → new commit">
            {result.pairs[0].old.missing ? '∅' : blobOrigin(result.pairs[0])} → {shortHash(result.pairs[0].commit)}
          </span>
        )}
        <div className="flex-1" />
        <span className="opacity-50 tabular-nums shrink-0">{idx >= 0 ? `${idx + 1} / ${paths.length}` : ''}</span>
        <button className="btn btn-ghost btn-xs btn-square" onClick={() => useSelection.getState().setFile(null)} title="All files"><LayoutList size={15} strokeWidth={1.75} /></button>
        <button className="btn btn-ghost btn-xs btn-square" onClick={() => stepFile(-1)} disabled={idx <= 0} title="Previous file  ["><ChevronUp size={15} strokeWidth={1.75} /></button>
        <button className="btn btn-ghost btn-xs btn-square" onClick={() => stepFile(1)} disabled={idx < 0 || idx >= paths.length - 1} title="Next file  ]"><ChevronDown size={15} strokeWidth={1.75} /></button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {loading && !result && <div className="p-4 text-xs opacity-50">Loading…</div>}
      {result && !result.stacked && <PairView pair={result.pairs[0]} path={file} mode={diffMode} />}
      {result && result.stacked && (
        <div className="flex-1 overflow-auto">
          <Notice kind="warning">{result.note}</Notice>
          {result.pairs.map((p) => (
            <div key={p.commit} className="hairline-b">
              <div className="flex items-center gap-2 px-2 h-8 text-[12px] bg-base-200/60 sticky top-0 z-10">
                <GitCommitHorizontal size={14} strokeWidth={1.75} className="opacity-50" />
                <span className="mono opacity-60">{shortHash(p.commit)}</span>
                <span className="truncate">{p.subject}</span>
                <span className={`ct-${p.type} text-[11px] font-medium shrink-0`}>{typeLabel[p.type]}</span>
              </div>
              <PairView pair={p} path={file} mode={diffMode} stacked />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function blobOrigin(p: Pair): string {
  return p.old.path !== p.new.path ? p.old.path : 'parent'
}

export function PairView({ pair, path, mode, stacked = false }: { pair: Pair; path: string; mode: 'split' | 'unified'; stacked?: boolean }) {
  const problem = pair.old.binary || pair.new.binary ? 'Binary file, no text diff.'
    : pair.old.tooLarge || pair.new.tooLarge ? 'File is larger than 2 MB, diff skipped.'
    : null
  if (problem) {
    return <div className={`${stacked ? 'p-3' : 'flex-1 flex items-center justify-center'} text-xs opacity-50`}>{problem}</div>
  }
  return (
    <div className={stacked ? '' : 'flex-1 min-h-0'}>
      <MergeViewHost oldText={pair.old.content} newText={pair.new.content} path={path} mode={mode} stacked={stacked} />
    </div>
  )
}
