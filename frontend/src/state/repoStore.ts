import { create } from 'zustand'
import { api, events, ApiError } from '../lib/api'
import type { Commit, RecentRepo, Ref, RepoInfo } from '../lib/types'

/**
 * Lookup tables that follow `commits`. They are filled in place as chunks
 * arrive and rebuilt on every load; subscribe to `commits` for changes, never
 * to these.
 */
const byHash = new Map<string, Commit>()
const position = new Map<string, number>()

export const commitOf = (hash: string) => byHash.get(hash)
export const positionOf = (hash: string) => position.get(hash)

interface RepoState {
  repo: RepoInfo | null
  refs: Ref[]
  refsByHash: Map<string, Ref[]>
  commits: Commit[]
  maxLanes: number
  loading: boolean
  loadId: number
  total: number | null
  error: string | null
  changedSinceLoad: boolean
  recent: RecentRepo[]
  gitMissing: boolean

  /** Opens a path, or asks for one with the native dialog. */
  open: (path?: string) => Promise<void>
  /** Reloads refs and history of the open repository. */
  refresh: () => Promise<void>
  loadRecent: () => Promise<void>
  forget: (path: string) => Promise<void>
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

export const useRepo = create<RepoState>()((set, get) => {
  // Opens (or re-opens) a path and streams its history.
  const load = async (path: string) => {
    try {
      const info = await api.openRepository(path)
      const refs = await api.refs(info.path)
      // Record the id before asking Go to stream, so no event can beat it.
      const loadId = ++loadSeq
      byHash.clear()
      position.clear()
      set({
        repo: info, refs, refsByHash: indexRefs(refs), commits: [], maxLanes: 1,
        loading: true, loadId, total: null, error: null, changedSinceLoad: false,
      })
      await api.loadHistory(info.path, loadId)
      void get().loadRecent()
    } catch (e) {
      const err = e as ApiError
      if (err.kind === 'cancelled') return
      set({ error: err.display ?? String(e), loading: false, gitMissing: err.kind === 'git_not_found' })
    }
  }

  return {
    repo: null,
    refs: [],
    refsByHash: new Map(),
    commits: [],
    maxLanes: 1,
    loading: false,
    loadId: 0,
    total: null,
    error: null,
    changedSinceLoad: false,
    recent: [],
    gitMissing: false,

    async open(path) {
      if (path) return load(path)
      try {
        const info = await api.openRepositoryDialog()
        await load(info.path)
      } catch (e) {
        if ((e as ApiError).kind !== 'cancelled') set({ error: (e as ApiError).display ?? String(e) })
      }
    },

    async refresh() {
      const repo = get().repo
      if (repo) await load(repo.path)
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
  }
})

export function subscribeRepoEvents() {
  events.onHistoryChunk(({ loadId, rows }) => {
    const s = useRepo.getState()
    if (loadId !== s.loadId) return
    const start = s.commits.length
    let maxLanes = s.maxLanes
    for (let i = 0; i < rows.length; i++) {
      const c = rows[i]
      byHash.set(c.hash, c)
      position.set(c.hash, start + i)
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
    useRepo.setState({ loading: false, error: new ApiError(message).display })
  })
  events.onRepoChanged((root) => {
    if (useRepo.getState().repo?.path === root) useRepo.setState({ changedSinceLoad: true })
  })
}
