import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, GitCommitHorizontal, Unlink } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, api } from '../../lib/api'
import { shortHash } from '../../lib/format'
import type { ChangeSet, DiffResult, FileChange, Mode } from '../../lib/types'
import { useRepo } from '../../state/repoStore'
import { useSelection } from '../../state/selectionStore'
import type { DiffMode } from '../../state/uiStore'
import { Notice } from '../shell/Notice'
import { PairView, typeLabel } from './DiffPanel'
import { iconFor } from '../../lib/fileIcon'


/**
 * Every changed file, one collapsible section each, in the files panel's
 * order. Diffs load as sections scroll near the viewport.
 */
export function AllFilesView({ changeSet, paths, hashes, mode, diffMode }: {
  changeSet: ChangeSet
  paths: string[]
  hashes: string[]
  mode: Mode
  diffMode: DiffMode
}) {
  const byPath = useMemo(() => new Map(changeSet.files.map((f) => [f.path, f])), [changeSet])
  const files = useMemo(() => paths.map((p) => byPath.get(p)).filter((f): f is FileChange => !!f), [paths, byPath])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  const toggle = (path: string) => setCollapsed((s) => { const n = new Set(s); n.has(path) ? n.delete(path) : n.add(path); return n })
  const allCollapsed = collapsed.size >= files.length && files.length > 0

  return (
    <div className="flex flex-col h-full min-h-0" id="panel-diff">
      <div className="panel-head hairline-b">
        <span className="font-medium tabular-nums">{files.length} {files.length === 1 ? 'file' : 'files'}</span>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-xs btn-square" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(files.map((f) => f.path)))} title={allCollapsed ? 'Expand all' : 'Collapse all'}>
          {allCollapsed ? <ChevronsUpDown size={15} strokeWidth={1.75} /> : <ChevronsDownUp size={15} strokeWidth={1.75} />}
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {files.map((f) => (
          <FileSection
            key={f.path}
            file={f}
            hashes={hashes}
            mode={mode}
            diffMode={diffMode}
            collapsed={collapsed.has(f.path)}
            onToggle={() => toggle(f.path)}
            scrollRoot={scrollRef}
          />
        ))}
      </div>
    </div>
  )
}

function FileSection({ file, hashes, mode, diffMode, collapsed, onToggle, scrollRoot }: {
  file: FileChange
  hashes: string[]
  mode: Mode
  diffMode: DiffMode
  collapsed: boolean
  onToggle: () => void
  scrollRoot: React.RefObject<HTMLDivElement | null>
}) {
  const repoPath = useRepo((s) => s.repo?.path)
  const [near, setNear] = useState(false)
  const [result, setResult] = useState<DiffResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Only fetch once the section is within a screen or so of the viewport.
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setNear(true)
    }, { root: scrollRoot.current, rootMargin: '800px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [near, scrollRoot])

  useEffect(() => {
    if (!near || collapsed || result || !repoPath) return
    let alive = true
    api.fileDiff(repoPath, hashes, mode, file.path).then(
      (r) => { if (alive) setResult(r) },
      (e: ApiError) => { if (alive) setError(e.display) },
    )
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, collapsed, repoPath, file.path])

  const openSingle = () => useSelection.getState().setFile(file.path)
  const Icon = iconFor(file.path)

  return (
    <div ref={ref} className="hairline-b">
      <div
        className="section-head flex items-center gap-2 px-2 h-9 text-[12px] sticky top-0 z-10 select-none"
        onClick={onToggle}
        onDoubleClick={openSingle}
        title="Click to collapse, double-click to open on its own"
      >
        {collapsed ? <ChevronRight size={14} strokeWidth={1.75} className="opacity-50 shrink-0" /> : <ChevronDown size={14} strokeWidth={1.75} className="opacity-50 shrink-0" />}
        <Icon size={14} strokeWidth={1.75} className="opacity-55 shrink-0" />
        <span className="truncate select-text" title={file.path}>
          {file.oldPath && <span className="opacity-50">{file.oldPath} → </span>}
          {file.path}
        </span>
        {file.touches.length > 1 && <span className="opacity-50 text-[10.5px] tabular-nums shrink-0">×{file.touches.length}</span>}
        {!file.composable && <Unlink size={12} strokeWidth={1.75} className="text-warning shrink-0" />}
        <div className="flex-1" />
        {file.binary ? (
          <span className="opacity-40 text-[10.5px]">binary</span>
        ) : (
          <span className="text-[11px] tabular-nums shrink-0">
            <span className="stat-add">+{file.additions}</span> <span className="stat-del">−{file.deletions}</span>
          </span>
        )}
        {typeLabel[file.type] && <span className={`ct-${file.type} text-[11px] font-medium shrink-0`}>{typeLabel[file.type]}</span>}
      </div>
      {!collapsed && (
        <div>
          {error && <Notice kind="error">{error}</Notice>}
          {!result && !error && <div className="h-16 flex items-center justify-center text-[11.5px] opacity-40">{near ? 'Loading…' : ''}</div>}
          {result && !result.stacked && <PairView pair={result.pairs[0]} path={file.path} mode={diffMode} stacked />}
          {result && result.stacked && (
            <div>
              <Notice kind="warning">{result.note}</Notice>
              {result.pairs.map((p) => (
                <div key={p.commit}>
                  <div className="flex items-center gap-2 px-3 h-7 text-[11.5px] opacity-70">
                    <GitCommitHorizontal size={13} strokeWidth={1.75} />
                    <span className="mono opacity-80">{shortHash(p.commit)}</span>
                    <span className="truncate">{p.subject}</span>
                  </div>
                  <PairView pair={p} path={file.path} mode={diffMode} stacked />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
