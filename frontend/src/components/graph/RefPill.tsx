import { GitBranch, Tag } from 'lucide-react'
import type { Ref } from '../../lib/types'
import { hintProps, useHint } from '../../state/hintStore'
import { useSearch } from '../../state/searchStore'
import { selectBranch } from '../../state/selectionStore'

/** Click: review the ref's own commits, drop any search, and scroll to its tip. */
async function pick(ref: Ref) {
  try {
    const message = await selectBranch(ref, { reveal: true })
    useSearch.getState().setText('')
    if (message) useHint.getState().flashMessage(message)
  } catch (e) {
    useHint.getState().flashMessage((e as Error).message)
  }
}

/** One branch or tag label. The same thing on a tip and on a search hit. */
export function RefPill({ r }: { r: Ref }) {
  return (
    <button
      type="button"
      className={`ref-pill ${r.isHead ? 'head' : r.kind === 'head' ? 'branch' : r.kind}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); void pick(r) }}
      {...hintProps(`${r.full} · click to review its commits`)}
    >
      {r.kind === 'tag' ? <Tag size={11} strokeWidth={2} /> : <GitBranch size={11} strokeWidth={2} />}
      {r.name}
    </button>
  )
}
