import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight, Folder, GitMerge, List, ListTree, Unlink, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, api } from '../../lib/api'
import { buildTree, filterFiles, flatten, visibleFilePaths, type FlatRow } from '../../lib/fileTree'
import { shortHash } from '../../lib/format'
import type { ChangeSet, ChangeType, FileChange } from '../../lib/types'
import { useRepo } from '../../state/repoStore'
import { useSelection, useSelectionInfo } from '../../state/selectionStore'
import { useUI } from '../../state/uiStore'
import { Notice } from '../shell/Notice'

const letter: Record<ChangeType, string> = { added: 'A', modified: 'M', deleted: 'D', renamed: 'R' }

/** Shared between the files panel and the diff navigation. */
export interface ChangesView {
  changeSet: ChangeSet | null
  paths: string[]
}
export const changesView: ChangesView = { changeSet: null, paths: [] }

export function ChangesPanel() {
  const repoPath = useRepo((s) => s.repo?.path)
  const { hashes, contiguous, mode, count } = useSelectionInfo()
  const requestedMode = useSelection((s) => s.mode)
  const setMode = useSelection((s) => s.setMode)
  const clear = useSelection((s) => s.clear)
  const file = useSelection((s) => s.file)
  const setFile = useSelection((s) => s.setFile)
  const { fileSort, flatFiles, setFileSort, setFlatFiles } = useUI()

  const [changeSet, setChangeSet] = useState<ChangeSet | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const key = hashes.join(',') + '|' + mode
  useEffect(() => {
    if (!repoPath || hashes.length === 0) {
      setChangeSet(null)
      setError(null)
      changesView.changeSet = null
      return
    }
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      api.listChanges(repoPath, hashes, mode).then(
        (cs) => { if (alive) { setChangeSet(cs); setError(null); setLoading(false); changesView.changeSet = cs } },
        (e: ApiError) => { if (alive) { setError(e.display); setChangeSet(null); setLoading(false) } },
      )
    }, 60)
    return () => { alive = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath, key])

  const files = useMemo(() => filterFiles(changeSet?.files ?? [], filter), [changeSet, filter])
  const rows: FlatRow[] = useMemo(() => {
    if (flatFiles) {
      const sorted = [...files].sort((a, b) => fileSort === 'type' && a.type !== b.type ? a.type.localeCompare(b.type) : a.path.localeCompare(b.path))
      return sorted.map((f) => ({ node: { kind: 'file' as const, name: f.path, path: f.path, change: f }, depth: 0 }))
    }
    return flatten(buildTree(files, fileSort), collapsed)
  }, [files, fileSort, flatFiles, collapsed])
  changesView.paths = useMemo(() => visibleFilePaths(rows), [rows])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 24, overscan: 15 })

  const toggleDir = (path: string) => setCollapsed((s) => { const n = new Set(s); n.has(path) ? n.delete(path) : n.add(path); return n })

  const totals = useMemo(() => {
    let a = 0, d = 0
    for (const f of changeSet?.files ?? []) { a += f.additions; d += f.deletions }
    return { a, d }
  }, [changeSet])

  return (
    <div className="flex flex-col h-full min-h-0" id="panel-files">
      <div className="flex items-center gap-2 h-7 px-2 hairline-b shrink-0 text-xs">
        {count === 0 ? (
          <span className="opacity-50">No commits selected</span>
        ) : (
          <>
            <span className="font-medium tabular-nums">{count} {count === 1 ? 'commit' : 'commits'}</span>
            <div className="join" title={contiguous ? 'Range: one snapshot diff across the chain. Aggregate: the union of each commit\'s own changes.' : 'Range needs a contiguous first-parent chain of commits'}>
              <button className={`btn btn-xs join-item ${requestedMode === 'aggregate' ? 'btn-active' : 'btn-ghost'}`} onClick={() => setMode('aggregate')}>Aggregate</button>
              <button className={`btn btn-xs join-item ${requestedMode === 'range' && contiguous ? 'btn-active' : 'btn-ghost'}`} disabled={!contiguous} onClick={() => setMode('range')}>Range</button>
            </div>
            {changeSet && (
              <span className="opacity-60 tabular-nums mono">
                {changeSet.files.length} files <span className="text-success">+{totals.a}</span> <span className="text-error">−{totals.d}</span>
              </span>
            )}
            <div className="flex-1" />
            <button className="btn btn-ghost btn-xs btn-square" onClick={clear} title="Clear selection (Esc)"><X size={12} /></button>
          </>
        )}
      </div>
      {count > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 hairline-b shrink-0">
          <input className="input input-xs flex-1" placeholder="Filter files" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <select className="select select-xs w-20" value={fileSort} onChange={(e) => setFileSort(e.target.value as 'name' | 'type')} title="Sort">
            <option value="name">Name</option>
            <option value="type">Type</option>
          </select>
          <button className="btn btn-ghost btn-xs btn-square" onClick={() => setFlatFiles(!flatFiles)} title={flatFiles ? 'Show as tree' : 'Show as flat list'}>
            {flatFiles ? <ListTree size={14} /> : <List size={14} />}
          </button>
        </div>
      )}
      {mode === 'range' && changeSet && (
        <div className="px-2 py-1 text-[11px] opacity-60 hairline-b shrink-0 mono">
          Range {changeSet.rangeBase === '4b825dc642cb6eb9a060e54bf8d69288fbee4904' ? '∅' : shortHash(changeSet.rangeBase ?? '')}..{shortHash(changeSet.hashes[0])}
        </div>
      )}
      {changeSet && changeSet.merges.length > 0 && (
        <div className="px-2 py-1 text-[11px] opacity-60 hairline-b shrink-0 flex items-center gap-1" title="Merge commits are diffed against their first parent: what the merge brought into the branch.">
          <GitMerge size={12} /> {changeSet.merges.length} merge {changeSet.merges.length === 1 ? 'commit' : 'commits'}, diffed against first parent
        </div>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      <div ref={parentRef} className="flex-1 overflow-auto">
        {count > 0 && changeSet && rows.length === 0 && !loading && (
          <div className="p-6 text-center opacity-50 text-xs">{filter ? 'No files match.' : 'No file changes.'}</div>
        )}
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => {
            const r = rows[item.index]
            return (
              <div key={r.node.path} style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${item.start}px)` }}>
                {r.node.kind === 'dir' ? (
                  <div className="tree-row flex items-center gap-1 pr-2 text-xs" style={{ paddingLeft: 6 + r.depth * 14 }} onClick={() => toggleDir(r.node.path)}>
                    {collapsed.has(r.node.path) ? <ChevronRight size={12} className="opacity-50" /> : <ChevronDown size={12} className="opacity-50" />}
                    <Folder size={13} className="opacity-50" />
                    <span className="truncate opacity-80">{r.node.name}</span>
                    <span className="opacity-40 text-[10px]">{r.node.fileCount}</span>
                  </div>
                ) : (
                  <FileRow change={r.node.change} name={r.node.name} depth={r.depth} active={file === r.node.path} onClick={() => setFile(r.node.path)} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function FileRow({ change, name, depth, active, onClick }: { change: FileChange; name: string; depth: number; active: boolean; onClick: () => void }) {
  return (
    <div className={`tree-row flex items-center gap-1.5 pr-2 text-xs ${active ? 'active' : ''}`} style={{ paddingLeft: 6 + depth * 14 + 14 }} onClick={onClick} title={change.oldPath ? `${change.oldPath} → ${change.path}` : change.path}>
      <span className={`ct ct-${change.type}`}>{letter[change.type]}</span>
      <span className={`truncate ${change.type === 'deleted' ? 'line-through opacity-60' : ''}`}>{name}</span>
      {change.oldPath && <span className="opacity-40 truncate text-[10px]">← {change.oldPath.split('/').pop()}</span>}
      {change.touches.length > 1 && <span className="badge badge-xs badge-ghost tabular-nums" title={`Changed in ${change.touches.length} selected commits`}>×{change.touches.length}</span>}
      {!change.composable && <Unlink size={11} className="text-warning shrink-0" />}
      <span className="flex-1" />
      {change.binary ? (
        <span className="opacity-40 text-[10px]">bin</span>
      ) : (
        <span className="mono text-[10px] tabular-nums shrink-0">
          <span className="text-success">+{change.additions}</span> <span className="text-error">−{change.deletions}</span>
        </span>
      )}
    </div>
  )
}
