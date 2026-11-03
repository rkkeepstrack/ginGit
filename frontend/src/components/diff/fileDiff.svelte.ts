import { ApiError, api } from '../../lib/api'
import type { DiffResult } from '../../lib/types'

/**
 * One file's diff for a selection, fetched when `enabled` and the inputs are
 * set. Create one per view; call `watch` from an $effect so inputs are tracked.
 */
export class FileDiff {
  result = $state.raw<DiffResult | null>(null)
  error = $state<string | null>(null)
  loading = $state(false)
  #generation = 0

  watch(repoPath: string | undefined, hashes: string[], path: string, enabled = true) {
    // A new file must not show the previous one's text under its name.
    this.result = null
    this.error = null
    const gen = ++this.#generation
    if (!enabled || !repoPath || hashes.length === 0) return
    this.loading = true
    api.fileDiff(repoPath, hashes, path).then(
      (r) => { if (gen === this.#generation) { this.result = r; this.loading = false } },
      (e: ApiError) => { if (gen === this.#generation) { this.error = e.display; this.loading = false } },
    )
  }
}
