import { create } from 'zustand'
import { api, events, ApiError } from '../lib/api'
import type { Commit, RecentRepo, Ref, RepoInfo } from '../lib/types'

interface RepoState {
  repo: RepoInfo | null
  refs: Ref[]
  refsByHash: Map<string, Ref[]>
  commits: Commit[]
  byHash: Map<string, Commit>
  position: Map<string, number>
  maxLanes: number
  loading: boolean
  loadId: number
  total: number | null
  error: string | null
  changedSinceLoad: boolean
  recent: RecentRepo[]
  gitMissing: boolean

  open: (path?: string) => Promise<void>
  refresh: () => Promise<void>
  loadRecent: () => Promise<void>
  forget: (path: string) => Promise<void>
  close: () => void
}

function indexRefs(refs: Ref[]): Map<string, Ref[]> {
  const m = new Map<string, Ref[]>()
  for (const r of refs) {
    const list = m.get(r.hash) ?? []
    list.push(r)
    m.set(r.hash, list)
  }
  for (const list of m.values()) {
    list.sort((a, b) => (a.isHead ? -1 : b.isHead ? 1 : a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)))
  }
  return m
}

let loadSeq = 0

export const useRepo = create<RepoState>()((set, get) => ({
  repo: null,
  refs: [],
  refsByHash: new Map(),
  commits: [],
  byHash: new Map(),
  position: new Map(),
  maxLanes: 1,
  loading: false,
  loadId: 0,
  total: null,
  error: null,
  changedSinceLoad: false,
  recent: [],
  gitMissing: false,

  async open(path) {
    try {
      const info = path ? await api.openRepository(path) : await api.openRepositoryDialog()
      set({ repo: info, error: null, commits: [], byHash: new Map(), position: new Map(), maxLanes: 1, total: null, changedSinceLoad: false })
      await get().refresh()
      void get().loadRecent()
    } catch (e) {
      const err = e as ApiError
      if (err.kind === 'cancelled') return
      if (err.kind === 'git_not_found') set({ gitMissing: true })
      set({ error: err.display ?? String(e) })
    }
  },

  async refresh() {
    const repo = get().repo
    if (!repo) return
    try {
      const [info, refs] = await Promise.all([api.openRepository(repo.path), api.refs(repo.path)])
      // Record the id before asking Go to stream, so no event can beat it.
      const loadId = ++loadSeq
      set({
        repo: info, refs, refsByHash: indexRefs(refs),
        commits: [], byHash: new Map(), position: new Map(), maxLanes: 1,
        loading: true, loadId, total: null, error: null, changedSinceLoad: false,
      })
      await api.loadHistory(repo.path, loadId)
    } catch (e) {
      set({ error: (e as ApiError).display ?? String(e), loading: false })
    }
  },

  async loadRecent() {
    try {
      set({ recent: await api.recentRepositories() })
    } catch {
      /* recent list is a convenience, never an error */
    }
  },

  async forget(path) {
    await api.forgetRepository(path)
    await get().loadRecent()
  },

  close() {
    set({ repo: null, commits: [], byHash: new Map(), position: new Map(), refs: [], refsByHash: new Map(), total: null, loading: false })
  },
}))

let subscribed = false
export function subscribeRepoEvents() {
  if (subscribed) return
  subscribed = true
  events.onHistoryChunk(({ loadId, rows }) => {
    const s = useRepo.getState()
    if (loadId !== s.loadId) return
    const start = s.commits.length
    let maxLanes = s.maxLanes
    for (let i = 0; i < rows.length; i++) {
      const c = rows[i]
      s.byHash.set(c.hash, c)
      s.position.set(c.hash, start + i)
      if (c.row.lanes > maxLanes) maxLanes = c.row.lanes
    }
    useRepo.setState({ commits: s.commits.concat(rows), maxLanes })
  })
  events.onHistoryDone(({ loadId, total }) => {
    if (loadId !== useRepo.getState().loadId) return
    useRepo.setState({ loading: false, total })
  })
  events.onHistoryError(({ loadId, message }) => {
    if (loadId !== useRepo.getState().loadId) return
    useRepo.setState({ loading: false, error: message.replace(/^[a-z_]+: /, '') })
  })
  events.onRepoChanged((root) => {
    if (useRepo.getState().repo?.path === root) useRepo.setState({ changedSinceLoad: true })
  })
}
