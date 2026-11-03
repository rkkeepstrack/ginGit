import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDownAZ, ChevronDown, ChevronRight, Folder, FolderOpen, GitMerge, List, ListTree, Tags, Unlink, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, api } from '../../lib/api'
import { buildTree, filterFiles, flatten, visibleFilePaths, type FlatRow } from '../../lib/fileTree'
import type { ChangeSet, ChangeType, FileChange } from '../../lib/types'
import { useRepo } from '../../state/repoStore'
import { useSelection, useSelectionInfo } from '../../state/selectionStore'
import { useUI } from '../../state/uiStore'
import { useChanges } from '../../state/changesStore'
import { hintProps } from '../../state/hintStore'
import { categoryFor, iconFor } from '../../lib/fileIcon'
import { Notice } from '../shell/Notice'

const letter: Record<ChangeType, string> = { added: 'A', modified: '', deleted: 'D', renamed: 'R' }

export function ChangesPanel() {
  const repoPath = useRepo((s) => s.repo?.path)
  const { hashes, mode, count } = useSelectionInfo()
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
      return
    }
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      api.listChanges(repoPath, hashes, mode).then(
        (cs) => { if (alive) { setChangeSet(cs); setError(null); setLoading(false) } },
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
  const paths = useMemo(() => visibleFilePaths(rows), [rows])
  const publish = useChanges((s) => s.set)
  useEffect(() => { publish(changeSet, paths) }, [changeSet, paths, publish])

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
      <div className="panel-head hairline-b">
        {count === 0 ? (
          <span className="opacity-50">No commits selected</span>
        ) : (
          <>
            <span className="font-medium tabular-nums shrink-0">{count} {count === 1 ? 'commit' : 'commits'}</span>
            <div className="flex-1" />
            <button className="btn btn-ghost btn-xs btn-square shrink-0" onClick={clear} {...hintProps('Clear selection  Esc')}><X size={14} strokeWidth={1.75} /></button>
          </>
        )}
      </div>
      {count > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 hairline-b shrink-0">
          <input className="input input-xs flex-1 min-w-0 text-[12px]" placeholder="Filter files" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button className="btn btn-ghost btn-xs btn-square shrink-0" onClick={() => setFileSort(fileSort === 'name' ? 'type' : 'name')} {...hintProps(fileSort === 'name' ? 'Sorted by name, click to sort by change type' : 'Sorted by change type, click to sort by name')}>
            {fileSort === 'name' ? <ArrowDownAZ size={15} strokeWidth={1.75} /> : <Tags size={15} strokeWidth={1.75} />}
          </button>
          <button className="btn btn-ghost btn-xs btn-square shrink-0" onClick={() => setFlatFiles(!flatFiles)} {...hintProps(flatFiles ? 'Show as tree' : 'Show as flat list')}>
            {flatFiles ? <ListTree size={15} strokeWidth={1.75} /> : <List size={15} strokeWidth={1.75} />}
          </button>
        </div>
      )}
      {changeSet && (
        <div className="flex items-center gap-2 px-2 h-7 text-[11.5px] opacity-70 hairline-b shrink-0 whitespace-nowrap overflow-hidden">
          <span className="tabular-nums shrink-0">
            {changeSet.files.length} {changeSet.files.length === 1 ? 'file' : 'files'} <span className="stat-add">+{totals.a}</span> <span className="stat-del">−{totals.d}</span>
          </span>
          <div className="flex-1" />
          {changeSet.merges.length > 0 && (
            <span className="inline-flex items-center gap-1 shrink-0" title="Merge commits are diffed against their first parent: what the merge brought into the branch.">
              <GitMerge size={12} strokeWidth={1.75} /> {changeSet.merges.length}
            </span>
          )}
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
                  <div className="tree-row flex items-center gap-1 pr-2" style={{ paddingLeft: 6 + r.depth * 14 }} onClick={() => toggleDir(r.node.path)}>
                    {collapsed.has(r.node.path) ? <ChevronRight size={13} strokeWidth={1.75} className="opacity-50 shrink-0" /> : <ChevronDown size={13} strokeWidth={1.75} className="opacity-50 shrink-0" />}
                    {collapsed.has(r.node.path) ? <Folder size={14} strokeWidth={1.75} className="opacity-55 shrink-0" /> : <FolderOpen size={14} strokeWidth={1.75} className="opacity-55 shrink-0" />}
                    <span className="truncate opacity-85">{r.node.name}</span>
                    <span className="opacity-40 text-[10.5px] tabular-nums">{r.node.fileCount}</span>
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
  const Icon = iconFor(change.path)
  return (
    <div className={`tree-row flex items-center gap-1.5 pr-2 ${active ? 'active' : ''}`} style={{ paddingLeft: 6 + depth * 14 + 17 }} onClick={onClick} title={change.oldPath ? `${change.oldPath} → ${change.path}` : change.path}>
      <Icon size={14} strokeWidth={1.75} className={`shrink-0 opacity-80 ft-${categoryFor(change.path)}`} />
      <span className={`truncate fn-${change.type}`}>{name}</span>
      {letter[change.type] && <span className={`ct ct-${change.type}`}>{letter[change.type]}</span>}
      {change.oldPath && <span className="opacity-40 truncate text-[10px]">← {change.oldPath.split('/').pop()}</span>}
      {change.touches.length > 1 && <span className="text-[10.5px] opacity-50 tabular-nums shrink-0" title={`Changed in ${change.touches.length} selected commits`}>×{change.touches.length}</span>}
      {!change.composable && <Unlink size={12} strokeWidth={1.75} className="text-warning shrink-0" />}
      <span className="flex-1" />
      {change.binary ? (
        <span className="opacity-40 text-[10px]">bin</span>
      ) : (
        <span className="text-[11px] tabular-nums shrink-0">
          <span className="stat-add">+{change.additions}</span> <span className="stat-del">−{change.deletions}</span>
        </span>
      )}
    </div>
  )
}
