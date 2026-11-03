import { ChevronDown, ChevronUp, FileDiff, LayoutList } from 'lucide-react'
import { changeMark } from '../../lib/changeType'
import { categoryFor, iconFor } from '../../lib/fileIcon'
import { shortHash } from '../../lib/format'
import { stepFile, useChanges } from '../../state/changesStore'
import { hintProps } from '../../state/hintStore'
import { useRepo } from '../../state/repoStore'
import { useSelectedHashes, useSelection } from '../../state/selectionStore'
import { useUI } from '../../state/uiStore'
import { Notice } from '../shell/Notice'
import { AllFilesView } from './AllFilesView'
import { DiffBody } from './DiffBody'
import { useFileDiff } from './useFileDiff'

export function DiffPanel() {
  const file = useSelection((s) => s.file)
  const changeSet = useChanges((s) => s.changeSet)
  const loading = useChanges((s) => s.loading)
  if (file) return <SingleFile file={file} />
  if (changeSet && changeSet.files.length > 0) return <AllFilesView key={changeSet.hashes.join(',')} />
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-[12.5px] opacity-40 select-none" id="panel-diff">
      <FileDiff size={28} strokeWidth={1.25} />
      {loading ? 'Loading…' : 'No file changes'}
    </div>
  )
}

function SingleFile({ file }: { file: string }) {
  const repoPath = useRepo((s) => s.repo?.path)
  const hashes = useSelectedHashes()
  const diffMode = useUI((s) => s.diffMode)
  const paths = useChanges((s) => s.paths)
  const { result, error, loading } = useFileDiff(repoPath, hashes, file)
  const idx = paths.indexOf(file)
  const segments = file.split('/')
  const FileIcon = iconFor(file)
  const mark = result && changeMark[result.type]

  return (
    <div className="flex flex-col h-full min-h-0" id="panel-diff">
      <div className="panel-head hairline-b">
        <FileIcon size={14} strokeWidth={1.75} className={`shrink-0 opacity-80 ft-${categoryFor(file)}`} />
        <span className="truncate select-text" title={file}>
          {segments.map((s, i) => (
            <span key={i} className={i === segments.length - 1 ? '' : 'opacity-50'}>{s}{i < segments.length - 1 ? '/' : ''}</span>
          ))}
        </span>
        {mark && <span className={`ct-${result.type} text-[11px] font-medium shrink-0`}>{mark.label}</span>}
        {result && !result.stacked && result.pairs[0] && (
          <span className="opacity-50 shrink-0" title="Old commit → new commit">
            {result.pairs[0].old.missing ? '∅' : result.pairs[0].old.path !== result.pairs[0].new.path ? result.pairs[0].old.path : 'parent'} → {shortHash(result.pairs[0].commit)}
          </span>
        )}
        <div className="flex-1" />
        <span className="opacity-50 tabular-nums shrink-0">{idx >= 0 ? `${idx + 1} / ${paths.length}` : ''}</span>
        <button className="btn btn-ghost btn-xs btn-square" onClick={() => stepFile(-1)} disabled={idx <= 0} {...hintProps('Previous file  [')}><ChevronUp size={15} strokeWidth={1.75} /></button>
        <button className="btn btn-ghost btn-xs btn-square" onClick={() => stepFile(1)} disabled={idx < 0 || idx >= paths.length - 1} {...hintProps('Next file  ]')}><ChevronDown size={15} strokeWidth={1.75} /></button>
        <button className="btn btn-ghost btn-xs btn-square" onClick={() => useSelection.getState().setFile(null)} {...hintProps('Back to all files')}><LayoutList size={15} strokeWidth={1.75} /></button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {loading && !result && <div className="p-4 text-xs opacity-50">Loading…</div>}
      {result && <DiffBody result={result} path={file} mode={diffMode} stacked={false} />}
    </div>
  )
}
