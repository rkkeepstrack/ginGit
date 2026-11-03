import { useRepo } from '../../state/repoStore'
import { useSelection } from '../../state/selectionStore'
import { useHint } from '../../state/hintStore'
import { modKey } from '../../lib/platform'
import { formatCount } from '../../lib/format'

const idleHint = `Click: select · ${modKey}-click: toggle · Shift-click: range`
const selectionHint = `[ or ${modKey}↑: previous file · ] or ${modKey}↓: next file · ${modKey}⇧D: diff layout · Esc: clear`

export function StatusBar() {
  const hint = useHint((s) => s.hint)
  const count = useSelection((s) => s.selected.size)
  const repo = useRepo((s) => s.repo)
  const total = useRepo((s) => s.commits.length)
  const loading = useRepo((s) => s.loading)

  return (
    <div className="h-6 shrink-0 flex items-center gap-3 px-3 text-[11px] hairline-t bg-base-200/40 select-none whitespace-nowrap overflow-hidden">
      {hint ? (
        <span className="truncate opacity-60">{hint}</span>
      ) : (
        <span className="truncate opacity-60">
          {count > 0 ? `${count} selected · ${selectionHint}` : idleHint}
        </span>
      )}
      <div className="flex-1" />
      {repo && (
        <span className="opacity-45 tabular-nums shrink-0">
          {loading && <span className="loading loading-spinner loading-xs mr-1 align-middle" />}
          {formatCount(total)} commits
        </span>
      )}
    </div>
  )
}
