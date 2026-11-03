import { GitBranch, Tag, Cloud } from 'lucide-react'
import type { Ref } from '../../lib/types'

const MAX = 3

export function RefPills({ refs }: { refs: Ref[] }) {
  if (refs.length === 0) return null
  const shown = refs.slice(0, MAX)
  const rest = refs.length - shown.length
  return (
    <span className="inline-flex items-center gap-1 mr-2 align-middle">
      {shown.map((r) => (
        <span
          key={r.full}
          className={`ref-pill ${r.isHead ? 'head' : r.kind === 'head' ? 'branch' : r.kind}`}
          title={r.full}
        >
          {r.kind === 'tag' ? <Tag size={10} /> : r.kind === 'remote' ? <Cloud size={10} /> : <GitBranch size={10} />}
          {r.name}
        </span>
      ))}
      {rest > 0 && (
        <span className="ref-pill remote" title={refs.slice(MAX).map((r) => r.name).join('\n')}>+{rest}</span>
      )}
    </span>
  )
}
