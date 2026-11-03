import { Filter } from 'lucide-react'
import { useRepo } from '../../state/repoStore'
import { useSearch } from '../../state/searchStore'

export function FilterPopover() {
  const refs = useRepo((s) => s.refs)
  const filters = useSearch((s) => s.filters)
  const setFilters = useSearch((s) => s.setFilters)
  const active = !!(filters.branch || filters.author || filters.since || filters.until)
  const heads = refs.filter((r) => r.kind === 'head')
  const remotes = refs.filter((r) => r.kind === 'remote')

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className={`btn btn-ghost btn-xs btn-square ${active ? 'text-primary' : ''}`} title="Filter by branch, author, date">
        <Filter size={14} />
        {active && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />}
      </div>
      <div tabIndex={0} className="dropdown-content bg-base-100 rounded-box shadow-lg z-50 w-72 p-3 mt-1 border border-base-content/10 flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="opacity-60">Branch</span>
          <select className="select select-xs w-full" value={filters.branch} onChange={(e) => setFilters({ branch: e.target.value })}>
            <option value="">All branches</option>
            {heads.length > 0 && <optgroup label="Local">{heads.map((r) => <option key={r.full} value={r.full}>{r.name}</option>)}</optgroup>}
            {remotes.length > 0 && <optgroup label="Remote">{remotes.map((r) => <option key={r.full} value={r.full}>{r.name}</option>)}</optgroup>}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="opacity-60">Author</span>
          <input className="input input-xs w-full" placeholder="name or email" value={filters.author} onChange={(e) => setFilters({ author: e.target.value })} />
        </label>
        <div className="flex gap-2">
          <label className="flex flex-col gap-1 text-xs flex-1">
            <span className="opacity-60">Since</span>
            <input type="date" className="input input-xs w-full" value={filters.since} onChange={(e) => setFilters({ since: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs flex-1">
            <span className="opacity-60">Until</span>
            <input type="date" className="input input-xs w-full" value={filters.until} onChange={(e) => setFilters({ until: e.target.value })} />
          </label>
        </div>
        {active && (
          <button className="btn btn-ghost btn-xs self-end" onClick={() => setFilters({ branch: '', author: '', since: '', until: '' })}>Clear filters</button>
        )}
      </div>
    </div>
  )
}
