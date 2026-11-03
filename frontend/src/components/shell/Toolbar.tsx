import { Columns2, GitBranch, RefreshCw, Rows3, Search, X } from 'lucide-react'

const ICON = { size: 16, strokeWidth: 1.75 } as const
import { useShallow } from 'zustand/react/shallow'
import { modKey } from '../../lib/platform'
import { useRepo } from '../../state/repoStore'
import { useSearch } from '../../state/searchStore'
import { useUI } from '../../state/uiStore'
import { hintProps } from '../../state/hintStore'
import { RepoMenu } from './RepoMenu'
import { ThemeToggle } from './ThemeToggle'

export function Toolbar() {
  const { repo, loading, changed } = useRepo(useShallow((s) => ({ repo: s.repo, loading: s.loading, changed: s.changedSinceLoad })))
  const refresh = useRepo((s) => s.refresh)
  const text = useSearch((s) => s.text)
  const setText = useSearch((s) => s.setText)
  const pending = useSearch((s) => s.pending)
  const diffMode = useUI((s) => s.diffMode)
  const setDiffMode = useUI((s) => s.setDiffMode)

  return (
    <div className="flex items-center gap-1.5 h-11 px-2 hairline-b shrink-0">
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <RepoMenu />
        {repo && (
          <span className="inline-flex items-center gap-1 text-[12px] opacity-70 min-w-0 truncate ml-1" title={repo.detached ? `Detached at ${repo.head}` : repo.branch}>
            <GitBranch size={13} strokeWidth={1.75} />
            {repo.detached ? `detached ${repo.head.slice(0, 7)}` : repo.branch}
          </span>
        )}
        <div className="flex-1" />
        <label className="input input-sm w-72 flex items-center gap-2 px-2.5 text-[12.5px]">
          {pending ? <span className="loading loading-spinner loading-xs" /> : <Search size={14} strokeWidth={1.75} className="opacity-50" />}
          <input
            id="commit-search"
            className="grow"
            placeholder={`Search message, author, hash  ${modKey}F`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!repo}
          />
          {text && <button className="btn btn-ghost btn-xs btn-square" onClick={() => setText('')}><X size={13} strokeWidth={1.75} /></button>}
        </label>
        <button className="btn btn-ghost btn-sm btn-square relative" onClick={() => void refresh()} disabled={!repo || loading} {...hintProps(`Reload history  ${modKey}R`)}>
          <RefreshCw {...ICON} className={loading ? 'animate-spin' : ''} />
          {changed && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-warning ring-2 ring-base-100" />}
        </button>
        <div className="join bg-base-200/60 rounded-field p-0.5 ml-1">
          <button className={`btn btn-xs btn-square join-item ${diffMode === 'split' ? 'bg-base-100 shadow-sm' : 'btn-ghost opacity-60'}`} onClick={() => setDiffMode('split')} {...hintProps(`Side-by-side diff  ${modKey}⇧D`)}><Columns2 size={15} strokeWidth={1.75} /></button>
          <button className={`btn btn-xs btn-square join-item ${diffMode === 'unified' ? 'bg-base-100 shadow-sm' : 'btn-ghost opacity-60'}`} onClick={() => setDiffMode('unified')} {...hintProps(`Unified diff  ${modKey}⇧D`)}><Rows3 size={15} strokeWidth={1.75} /></button>
        </div>
        <ThemeToggle />
      </div>
    </div>
  )
}
