import { GitBranch, Tag, Cloud } from 'lucide-react'
import type { Ref } from '../../lib/types'
import { selectBranch } from '../../state/selectionStore'
import { hintProps, useHint } from '../../state/hintStore'

const MAX = 3

async function pick(ref: Ref) {
  try {
    const message = await selectBranch(ref)
    if (message) useHint.getState().flashMessage(message)
  } catch (e) {
    useHint.getState().flashMessage((e as Error).message)
  }
}

export function RefPills({ refs }: { refs: Ref[] }) {
  if (refs.length === 0) return null
  const shown = refs.slice(0, MAX)
  const rest = refs.length - shown.length
  return (
    <span className="inline-flex items-center gap-1 mr-2 align-middle">
      {shown.map((r) => (
        <button
          type="button"
          key={r.full}
          className={`ref-pill ${r.isHead ? 'head' : r.kind === 'head' ? 'branch' : r.kind}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); void pick(r) }}
          {...hintProps(`${r.full} · click to select its commits`)}
        >
          {r.kind === 'tag' ? <Tag size={11} strokeWidth={2} /> : r.kind === 'remote' ? <Cloud size={11} strokeWidth={2} /> : <GitBranch size={11} strokeWidth={2} />}
          {r.name}
        </button>
      ))}
      {rest > 0 && (
        <span className="ref-pill remote" title={refs.slice(MAX).map((r) => r.name).join('\n')}>+{rest}</span>
      )}
    </span>
  )
}
