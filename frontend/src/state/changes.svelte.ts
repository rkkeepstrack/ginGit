import { untrack } from 'svelte'
import { ApiError, api } from '../lib/api'
import type { ChangeSet } from '../lib/types'
import { recoverIfNotOpen, repo } from './repo.svelte'
import { selection, setFile } from './selection.svelte'

/**
 * The consolidated change set for the current selection. The store fetches
 * it itself whenever the selection or the history changes, so every panel
 * reads the same result and none of them has to be mounted for it to exist.
 */
class ChangesStore {
  changeSet = $state.raw<ChangeSet | null>(null)
  loading = $state(false)
  error = $state<string | null>(null)
  /** File order as the files panel shows it; it drives prev/next navigation. */
  paths = $state.raw<string[]>([])
}

export const changes = new ChangesStore()

let generation = 0
let timer: ReturnType<typeof setTimeout> | undefined
let lastTrigger = 0

function fetchChanges(repoPath: string | undefined, hashes: string[]) {
  clearTimeout(timer)
  const gen = ++generation
  if (!repoPath || hashes.length === 0) {
    changes.changeSet = null
    changes.loading = false
    changes.error = null
    return
  }
  changes.loading = true
  // Bursts (arrow keys, shift-click runs) are debounced; a lone change goes out at once.
  const now = performance.now()
  const burst = now - lastTrigger < 150
  lastTrigger = now
  timer = setTimeout(() => {
    api.listChanges(repoPath, hashes).then(
      (cs) => { if (gen === generation) { changes.changeSet = cs; changes.loading = false; changes.error = null } },
      (e: ApiError) => {
        if (gen !== generation) return
        // A recovery reloads the history, which re-triggers this fetch.
        if (recoverIfNotOpen(e)) return
        changes.changeSet = null
        changes.loading = false
        changes.error = e.display
      },
    )
  }, burst ? 60 : 0)
}

$effect.root(() => {
  $effect(() => {
    const path = repo.info?.path
    const hashes = selection.hashes
    untrack(() => fetchChanges(path, hashes))
  })
})

/** Records (or forgets) that the user has seen a file as shown, then refreshes the review states. */
export async function markReviewed(path: string, seen: boolean) {
  const root = repo.info?.path
  if (!root) return
  await api.markReviewed(root, selection.hashes, path, seen)
  fetchChanges(root, selection.hashes)
}

/** Moves the open file forward or back through the files panel's order. */
export function stepFile(delta: number) {
  const { file } = selection
  const { paths } = changes
  if (paths.length === 0) return
  const i = file ? paths.indexOf(file) : -1
  const next = i < 0 ? (delta > 0 ? 0 : paths.length - 1) : Math.max(0, Math.min(paths.length - 1, i + delta))
  setFile(paths[next])
}
