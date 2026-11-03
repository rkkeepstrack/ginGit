import { useRepo } from '../../state/repoStore'
import { useSelection } from '../../state/selectionStore'
import { useHint } from '../../state/hintStore'
import { modKey } from '../../lib/platform'
import { formatCount } from '../../lib/format'

type Hint = { keys: string[]; label: string }

const Key = ({ k }: { k: string }) => <kbd className="kbd kbd-xs mx-0.5 font-[inherit] text-[10px] min-h-4 h-4 px-1">{k}</kbd>

function Hints({ hints }: { hints: Hint[] }) {
  return (
    <span className="inline-flex items-center gap-3">
      {hints.map((h) => (
        <span key={h.label} className="inline-flex items-center">
          {h.keys.map((k) => <Key key={k} k={k} />)}
          <span className="ml-1">{h.label}</span>
        </span>
      ))}
    </span>
  )
}

const idleHints: Hint[] = [
  { keys: ['Click'], label: 'select' },
  { keys: [`${modKey} Click`], label: 'toggle' },
  { keys: ['⇧ Click'], label: 'range' },
]
const selectionHints: Hint[] = [
  { keys: ['[', `${modKey} ↑`], label: 'previous file' },
  { keys: [']', `${modKey} ↓`], label: 'next file' },
  { keys: [`${modKey} ⇧ D`], label: 'diff layout' },
  { keys: ['Esc'], label: 'clear' },
]

export function StatusBar() {
  const hint = useHint((s) => s.hint)
  const flash = useHint((s) => s.flash)
  const count = useSelection((s) => s.selected.size)
  const repo = useRepo((s) => s.repo)
  const total = useRepo((s) => s.commits.length)
  const loading = useRepo((s) => s.loading)

  return (
    <div className="h-6 shrink-0 flex items-center gap-3 px-3 text-[11px] hairline-t bg-base-200/40 select-none whitespace-nowrap overflow-hidden">
      {flash ? (
        <span className="truncate brand font-medium">{flash}</span>
      ) : hint ? (
        <span className="truncate opacity-60">{hint}</span>
      ) : (
        <span className="truncate opacity-60">
          {count > 0 && <span className="mr-3 tabular-nums">{count} selected</span>}
          <Hints hints={count > 0 ? selectionHints : idleHints} />
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
