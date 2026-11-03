import { create } from 'zustand'
import { api } from '../lib/api'
import { useRepo } from './repoStore'

interface SearchState {
  text: string
  /** Commit indices matching the text, or null when nothing is filtering. */
  matches: number[] | null
  pending: boolean
  setText: (t: string) => void
}

let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0

async function run() {
  const { text } = useSearch.getState()
  const repo = useRepo.getState().repo
  if (!repo || !text.trim()) {
    useSearch.setState({ matches: null, pending: false })
    return
  }
  const gen = ++generation
  useSearch.setState({ pending: true })
  try {
    const matches = await api.searchCommits(repo.path, text.trim())
    if (gen === generation) useSearch.setState({ matches, pending: false })
  } catch {
    if (gen === generation) useSearch.setState({ matches: [], pending: false })
  }
}

function schedule() {
  clearTimeout(timer)
  timer = setTimeout(() => void run(), 120)
}

export const useSearch = create<SearchState>()((set) => ({
  text: '',
  matches: null,
  pending: false,
  setText(text) {
    set({ text })
    schedule()
  },
}))

// Matches are row indices into the history: a reload invalidates them, and the
// search re-runs once the new history has arrived.
useRepo.subscribe((s, prev) => {
  if (s.loadId !== prev.loadId) useSearch.setState({ matches: null })
  if (prev.loading && !s.loading && s.loadId !== 0) schedule()
})
