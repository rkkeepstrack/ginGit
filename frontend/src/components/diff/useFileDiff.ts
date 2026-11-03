import { useEffect, useState } from 'react'
import { ApiError, api } from '../../lib/api'
import type { DiffResult } from '../../lib/types'

/** Fetches one file's diff for the selection. Pass enabled=false to defer. */
export function useFileDiff(repoPath: string | undefined, hashes: string[], path: string, enabled = true) {
  const [result, setResult] = useState<DiffResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // A new file must not show the previous one's text under its name.
    setResult(null)
    setError(null)
    if (!enabled || !repoPath || hashes.length === 0) return
    let alive = true
    setLoading(true)
    api.fileDiff(repoPath, hashes, path).then(
      (r) => { if (alive) { setResult(r); setLoading(false) } },
      (e: ApiError) => { if (alive) { setError(e.display); setLoading(false) } },
    )
    return () => { alive = false }
  }, [enabled, repoPath, hashes, path])

  return { result, error, loading }
}
