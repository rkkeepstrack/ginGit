import { create } from 'zustand'
import { ApiError, api } from '../lib/api'
import type { ChangeSet } from '../lib/types'
import { recoverIfNotOpen, useRepo } from './repoStore'
import { sortedSelection, useSelection } from './selectionStore'

/**
 * The consolidated change set for the current selection. The store fetches
 * it itself whenever the selection or the history changes, so every panel
 * reads the same result and none of them has to be mounted for it to exist.
 */
interface ChangesState {
  changeSet: ChangeSet | null
  loading: boolean
  error: string | null
  /** File order as the files panel shows it; it drives prev/next navigation. */
  paths: string[]
  setPaths: (paths: string[]) => void
}

export const useChanges = create<ChangesState>()((set) => ({
  changeSet: null,
  loading: false,
  error: null,
  paths: [],
  setPaths: (paths) => set({ paths }),
}))

let generation = 0
let timer: ReturnType<typeof setTimeout> | undefined
let lastKey = ''

function schedule() {
  const repoPath = useRepo.getState().repo?.path
  const hashes = sortedSelection(useSelection.getState().selected)
  const key = repoPath + '|' + hashes.join(',')
  if (key === lastKey) return
  lastKey = key
  clearTimeout(timer)
  const gen = ++generation
  if (!repoPath || hashes.length === 0) {
    useChanges.setState({ changeSet: null, loading: false, error: null })
    return
  }
  useChanges.setState({ loading: true })
  // A short debounce absorbs shift-click runs and arrow-key bursts.
  timer = setTimeout(() => {
    api.listChanges(repoPath, hashes).then(
      (cs) => { if (gen === generation) useChanges.setState({ changeSet: cs, loading: false, error: null }) },
      (e: ApiError) => {
        if (gen !== generation) return
        // A recovery reloads the history, which re-triggers this fetch.
        if (recoverIfNotOpen(e)) { lastKey = ''; return }
        useChanges.setState({ changeSet: null, loading: false, error: e.display })
      },
    )
  }, 60)
}

useSelection.subscribe((s, prev) => { if (s.selected !== prev.selected) schedule() })
useRepo.subscribe((s, prev) => { if (s.commits !== prev.commits || s.repo !== prev.repo) schedule() })

/** Moves the open file forward or back through the files panel's order. */
export function stepFile(delta: number) {
  const { file, setFile } = useSelection.getState()
  const { paths } = useChanges.getState()
  if (paths.length === 0) return
  const i = file ? paths.indexOf(file) : -1
  const next = i < 0 ? (delta > 0 ? 0 : paths.length - 1) : Math.max(0, Math.min(paths.length - 1, i + delta))
  setFile(paths[next])
}
