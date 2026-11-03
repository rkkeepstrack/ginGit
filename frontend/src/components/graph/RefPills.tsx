import type { Ref } from '../../lib/types'
import { RefPill } from './RefPill'

const MAX = 3

/** Local branches and tags only; remote-tracking refs add nothing to the picture. */
export function RefPills({ refs: all }: { refs: Ref[] }) {
  const refs = all.filter((r) => r.kind !== 'remote')
  if (refs.length === 0) return null
  const shown = refs.slice(0, MAX)
  const rest = refs.length - shown.length
  return (
    <span className="inline-flex items-center gap-1 mr-2 align-middle">
      {shown.map((r) => <RefPill key={r.full} r={r} />)}
      {rest > 0 && (
        <span className="ref-pill remote" title={refs.slice(MAX).map((r) => r.name).join('\n')}>+{rest}</span>
      )}
    </span>
  )
}
