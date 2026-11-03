import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Unlink } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { changeMark } from '../../lib/changeType'
import { categoryFor, iconFor } from '../../lib/fileIcon'
import type { FileChange } from '../../lib/types'
import { useChanges } from '../../state/changesStore'
import { hintProps } from '../../state/hintStore'
import { useRepo } from '../../state/repoStore'
import { useSelectedHashes, useSelection } from '../../state/selectionStore'
import { useUI } from '../../state/uiStore'
import { Notice } from '../shell/Notice'
import { pressable } from '../shell/pressable'
import { DiffBody } from './DiffBody'
import { useFileDiff } from './useFileDiff'

/**
 * Every changed file, one collapsible section each, in the files panel's
 * order. Diffs load as sections scroll near the viewport.
 */
export function AllFilesView() {
  const changeSet = useChanges((s) => s.changeSet)
  const paths = useChanges((s) => s.paths)
  const files = useMemo(() => {
    const byPath = new Map(changeSet?.files.map((f) => [f.path, f]))
    return paths.map((p) => byPath.get(p)).filter((f): f is FileChange => !!f)
  }, [changeSet, paths])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  const toggle = (path: string) => setCollapsed((s) => { const n = new Set(s); n.has(path) ? n.delete(path) : n.add(path); return n })
  const allCollapsed = collapsed.size >= files.length && files.length > 0

  return (
    <div className="flex flex-col h-full min-h-0" id="panel-diff">
      <div className="panel-head hairline-b">
        <span className="font-medium tabular-nums">{files.length} {files.length === 1 ? 'file' : 'files'}</span>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-xs btn-square" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(files.map((f) => f.path)))} {...hintProps(allCollapsed ? 'Expand all files' : 'Collapse all files')}>
          {allCollapsed ? <ChevronsUpDown size={15} strokeWidth={1.75} /> : <ChevronsDownUp size={15} strokeWidth={1.75} />}
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {files.map((f) => (
          <FileSection key={f.path} file={f} collapsed={collapsed.has(f.path)} onToggle={() => toggle(f.path)} scrollRoot={scrollRef} />
        ))}
      </div>
    </div>
  )
}

function FileSection({ file, collapsed, onToggle, scrollRoot }: {
  file: FileChange
  collapsed: boolean
  onToggle: () => void
  scrollRoot: React.RefObject<HTMLDivElement | null>
}) {
  const repoPath = useRepo((s) => s.repo?.path)
  const hashes = useSelectedHashes()
  const diffMode = useUI((s) => s.diffMode)
  const [near, setNear] = useState(false)
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

  const { result, error } = useFileDiff(repoPath, hashes, file.path, near && !collapsed)
  const Icon = iconFor(file.path)
  const mark = changeMark[file.type]
  const openSingle = () => useSelection.getState().setFile(file.path)

  return (
    <div ref={ref} className="hairline-b">
      <div
        className="section-head flex items-center gap-2 px-2 h-9 text-[12px] sticky top-0 z-10 select-none"
        onClick={onToggle}
        onDoubleClick={openSingle}
        {...pressable(onToggle)}
        {...hintProps('Click to collapse, double-click to open this file on its own')}
      >
        {collapsed ? <ChevronRight size={14} strokeWidth={1.75} className="opacity-50 shrink-0" /> : <ChevronDown size={14} strokeWidth={1.75} className="opacity-50 shrink-0" />}
        <Icon size={14} strokeWidth={1.75} className={`shrink-0 opacity-80 ft-${categoryFor(file.path)}`} />
        <span className={`truncate select-text fn-${file.type}`} title={file.path}>
          {file.oldPath && <span className="opacity-50">{file.oldPath} → </span>}
          {file.path}
        </span>
        {file.touches.length > 1 && <span className="opacity-50 text-[10.5px] tabular-nums shrink-0" {...hintProps(`Changed in ${file.touches.length} selected commits`)}>×{file.touches.length}</span>}
        {!file.composable && <Unlink size={12} strokeWidth={1.75} className="text-warning shrink-0" />}
        <div className="flex-1" />
        {file.binary ? (
          <span className="opacity-40 text-[10.5px]">binary</span>
        ) : (
          <span className="text-[11px] tabular-nums shrink-0">
            <span className="stat-add">+{file.additions}</span> <span className="stat-del">−{file.deletions}</span>
          </span>
        )}
        {mark && <span className={`ct-${file.type} text-[11px] font-medium shrink-0`}>{mark.label}</span>}
      </div>
      {!collapsed && (
        <div>
          {error && <Notice kind="error">{error}</Notice>}
          {!result && !error && <div className="h-16 flex items-center justify-center text-[11.5px] opacity-40">{near ? 'Loading…' : ''}</div>}
          {result && <DiffBody result={result} path={file.path} mode={diffMode} stacked />}
        </div>
      )}
    </div>
  )
}
