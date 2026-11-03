import { create } from 'zustand'
import { api } from '../lib/api'
import { useRepo } from './repoStore'

interface Filters { branch: string; author: string; since: string; until: string }

interface SearchState {
  text: string
  filters: Filters
  /** Commit indices matching the query, or null when nothing is filtering. */
  matches: number[] | null
  pending: boolean
  setText: (t: string) => void
  setFilters: (f: Partial<Filters>) => void
  clearAll: () => void
  run: () => Promise<void>
}

const empty: Filters = { branch: '', author: '', since: '', until: '' }
let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0

export const useSearch = create<SearchState>()((set, get) => ({
  text: '',
  filters: empty,
  matches: null,
  pending: false,

  setText(text) {
    set({ text })
    schedule()
  },
  setFilters(f) {
    set((s) => ({ filters: { ...s.filters, ...f } }))
    schedule()
  },
  clearAll() {
    set({ text: '', filters: empty, matches: null })
  },
  async run() {
    const { text, filters } = get()
    const repo = useRepo.getState().repo
    const active = text.trim() || filters.branch || filters.author.trim() || filters.since || filters.until
    if (!repo || !active) {
      set({ matches: null, pending: false })
      return
    }
    const gen = ++generation
    set({ pending: true })
    try {
      const matches = await api.searchCommits(repo.path, {
        text: text.trim(),
        author: filters.author.trim(),
        branch: filters.branch,
        since: filters.since ? new Date(filters.since).toISOString() : '0001-01-01T00:00:00Z',
        until: filters.until ? new Date(filters.until + 'T23:59:59').toISOString() : '0001-01-01T00:00:00Z',
      })
      if (gen === generation) set({ matches, pending: false })
    } catch {
      if (gen === generation) set({ matches: [], pending: false })
    }
  },
}))

function schedule() {
  clearTimeout(timer)
  timer = setTimeout(() => void useSearch.getState().run(), 120)
}

export function isFiltering(s: SearchState): boolean {
  return s.matches !== null
}
