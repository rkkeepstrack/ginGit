import { create } from 'zustand'
import { api } from '../lib/api'
import { useRepo } from './repoStore'

interface SearchState {
  text: string
  /** Commit indices matching the text, or null when nothing is filtering. */
  matches: number[] | null
  /** Branch each match sits on; stands in for the graph while filtering. */
  names: Record<string, string>
  pending: boolean
  setText: (t: string) => void
}

/** Naming is one git call; beyond this many hits the badges are not worth it. */
const MAX_NAMED = 2000

let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0

async function run() {
  const { text } = useSearch.getState()
  const repo = useRepo.getState().repo
  if (!repo || !text.trim()) {
    useSearch.setState({ matches: null, names: {}, pending: false })
    return
  }
  const gen = ++generation
  useSearch.setState({ pending: true })
  try {
    const matches = await api.searchCommits(repo.path, text.trim())
    if (gen !== generation) return
    useSearch.setState({ matches, pending: false })
    if (matches.length > 0 && matches.length <= MAX_NAMED) {
      const commits = useRepo.getState().commits
      const names = await api.nameCommits(repo.path, matches.map((i) => commits[i].hash))
      if (gen === generation) useSearch.setState({ names })
    } else {
      useSearch.setState({ names: {} })
    }
  } catch {
    if (gen === generation) useSearch.setState({ matches: [], names: {}, pending: false })
  }
}

function schedule() {
  clearTimeout(timer)
  timer = setTimeout(() => void run(), 120)
}

export const useSearch = create<SearchState>()((set) => ({
  text: '',
  matches: null,
  names: {},
  pending: false,
  setText(text) {
    set({ text })
    schedule()
  },
}))

// Matches are row indices into the history: a reload invalidates them, and the
// search re-runs once the new history has arrived.
useRepo.subscribe((s, prev) => {
  if (s.loadId !== prev.loadId) useSearch.setState({ matches: null, names: {} })
  if (prev.loading && !s.loading && s.loadId !== 0) schedule()
})
