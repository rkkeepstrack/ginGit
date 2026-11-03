import { ChevronDown, FolderOpen, X } from 'lucide-react'
import { useRepo } from '../../state/repoStore'
import { useSelection } from '../../state/selectionStore'

export function RepoMenu() {
  const repo = useRepo((s) => s.repo)
  const recent = useRepo((s) => s.recent)
  const open = useRepo((s) => s.open)
  const forget = useRepo((s) => s.forget)
  const clear = useSelection((s) => s.clear)

  const pick = (path?: string) => {
    clear()
    void open(path)
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  return (
    <div className="dropdown">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-sm px-2 gap-1 font-semibold normal-case">
        {repo?.name ?? 'Open repository'}
        <ChevronDown size={14} className="opacity-50" />
      </div>
      <ul tabIndex={0} className="dropdown-content menu menu-sm bg-base-100 rounded-box shadow-lg z-50 w-72 p-1 mt-1 border border-base-content/10">
        <li>
          <a onClick={() => pick()}><FolderOpen size={14} /> Open…</a>
        </li>
        {recent.length > 0 && <li className="menu-title text-[10px] pt-2">Recent</li>}
        {recent.map((r) => (
          <li key={r.path}>
            <a className={`flex items-center gap-2 ${r.path === repo?.path ? 'active' : ''}`} onClick={() => pick(r.path)} title={r.path}>
              <span className="flex-1 min-w-0 truncate">
                <span className="font-medium">{r.name}</span>
                <span className="block text-[10px] opacity-50 truncate">{r.path}</span>
              </span>
              <button
                className="btn btn-ghost btn-xs btn-square opacity-40 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); void forget(r.path) }}
                title="Remove from recent"
              >
                <X size={12} />
              </button>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
