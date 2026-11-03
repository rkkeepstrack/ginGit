import { Columns2, GitBranch, RefreshCw, Rows3, Search, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { formatCount } from '../../lib/format'
import { modKey } from '../../lib/platform'
import { useRepo } from '../../state/repoStore'
import { useSearch } from '../../state/searchStore'
import { useUI } from '../../state/uiStore'
import { FilterPopover } from './FilterPopover'
import { RepoMenu } from './RepoMenu'
import { ThemeToggle } from './ThemeToggle'

export function Toolbar() {
  const { repo, loading, total, count, changed } = useRepo(useShallow((s) => ({
    repo: s.repo, loading: s.loading, total: s.total, count: s.commits.length, changed: s.changedSinceLoad,
  })))
  const refresh = useRepo((s) => s.refresh)
  const text = useSearch((s) => s.text)
  const setText = useSearch((s) => s.setText)
  const matches = useSearch((s) => s.matches)
  const pending = useSearch((s) => s.pending)
  const diffMode = useUI((s) => s.diffMode)
  const setDiffMode = useUI((s) => s.setDiffMode)

  return (
    <div className="flex items-center gap-2 h-10 px-2 hairline-b shrink-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <RepoMenu />
        {repo && (
          <span className="inline-flex items-center gap-1 text-xs opacity-70 min-w-0 truncate" title={repo.detached ? `Detached at ${repo.head}` : repo.branch}>
            <GitBranch size={12} />
            {repo.detached ? `detached ${repo.head.slice(0, 7)}` : repo.branch}
          </span>
        )}
        {repo && (
          <span className="text-xs opacity-50 shrink-0 tabular-nums">
            {loading && <span className="loading loading-spinner loading-xs mr-1 align-middle" />}
            {formatCount(count)}{total !== null && total !== count ? ` / ${formatCount(total)}` : ''} commits
            {matches && <span> · {formatCount(matches.length)} match</span>}
          </span>
        )}
        <div className="flex-1" />
        <label className="input input-sm w-72 flex items-center gap-2 px-2">
          {pending ? <span className="loading loading-spinner loading-xs" /> : <Search size={13} className="opacity-50" />}
          <input
            id="commit-search"
            className="grow"
            placeholder={`Search message, author, hash  ${modKey}F`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!repo}
          />
          {text && <button className="btn btn-ghost btn-xs btn-square" onClick={() => setText('')}><X size={12} /></button>}
        </label>
        <FilterPopover />
        <button className="btn btn-ghost btn-xs btn-square relative" onClick={() => void refresh()} disabled={!repo || loading} title={`Refresh history  ${modKey}R`}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {changed && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-warning ring-2 ring-base-100" title="Repository changed since last load" />}
        </button>
        <div className="join">
          <button className={`btn btn-xs join-item ${diffMode === 'split' ? 'btn-active' : 'btn-ghost'}`} onClick={() => setDiffMode('split')} title={`Side by side  ${modKey}⇧D`}><Columns2 size={14} /></button>
          <button className={`btn btn-xs join-item ${diffMode === 'unified' ? 'btn-active' : 'btn-ghost'}`} onClick={() => setDiffMode('unified')} title={`Unified  ${modKey}⇧D`}><Rows3 size={14} /></button>
        </div>
        <ThemeToggle />
      </div>
    </div>
  )
}
