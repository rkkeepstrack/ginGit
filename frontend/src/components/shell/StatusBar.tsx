import { useRepo } from '../../state/repoStore'
import { useSelection } from '../../state/selectionStore'
import { useHint } from '../../state/hintStore'
import { modKey } from '../../lib/platform'
import { formatCount } from '../../lib/format'

const defaultHint = `Click selects · ${modKey}-click toggles · ⇧-click selects a range · Esc clears`

export function StatusBar() {
  const hint = useHint((s) => s.hint)
  const flash = useHint((s) => s.flash)
  const count = useSelection((s) => s.selected.size)
  const repo = useRepo((s) => s.repo)
  const total = useRepo((s) => s.commits.length)
  const loading = useRepo((s) => s.loading)

  const text = flash ?? hint ?? (count > 0 ? `${count} selected · [ ] previous/next file · ${modKey}⇧D switches diff layout · Esc clears` : defaultHint)
  return (
    <div className="h-6 shrink-0 flex items-center gap-3 px-3 text-[11px] hairline-t bg-base-200/40 select-none whitespace-nowrap overflow-hidden">
      <span className={`truncate ${flash ? 'text-primary font-medium' : 'opacity-60'}`}>{text}</span>
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
