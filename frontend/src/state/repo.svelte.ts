import { api, events, ApiError } from '../lib/api'
import type { Commit, RecentRepo, Ref, RepoInfo } from '../lib/types'
import { clear } from './selection.svelte'

/**
 * Lookup tables that follow `commits`. They are filled in place as chunks
 * arrive and rebuilt on every load; depend on `repo.commits` for reactivity.
 */
const byHash = new Map<string, Commit>()
const position = new Map<string, number>()
export const commitOf = (hash: string) => byHash.get(hash)
export const positionOf = (hash: string) => position.get(hash)

class RepoStore {
  info = $state<RepoInfo | null>(null)
  refs = $state.raw<Ref[]>([])
  refsByHash = $state.raw<Map<string, Ref[]>>(new Map())
  /** Raw on purpose: 86k commits must not become deep proxies. */
  commits = $state.raw<Commit[]>([])
  maxLanes = $state(1)
  loading = $state(false)
  loadId = $state(0)
  error = $state<string | null>(null)
  changedSinceLoad = $state(false)
  recent = $state.raw<RecentRepo[]>([])
  gitMissing = $state(false)
}

export const repo = new RepoStore()

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

/** Opens (or re-opens) a path and streams its history. A refresh keeps the selection, a switch drops it. */
async function load(path: string) {
  if (path !== repo.info?.path) clear()
  try {
    const info = await api.openRepository(path)
    const refs = await api.refs(info.path)
    // Record the id before asking Go to stream, so no event can beat it.
    const loadId = ++loadSeq
    byHash.clear()
    position.clear()
    repo.info = info
    repo.refs = refs
    repo.refsByHash = indexRefs(refs)
    repo.commits = []
    repo.maxLanes = 1
    repo.loading = true
    repo.loadId = loadId
    repo.error = null
    repo.changedSinceLoad = false
    await api.loadHistory(info.path, loadId)
    void loadRecent()
  } catch (e) {
    const err = e as ApiError
    if (err.kind === 'cancelled') return
    repo.error = err.display
    repo.loading = false
    repo.gitMissing = err.kind === 'git_not_found'
  }
}

/** Opens a path, or asks for one with the native dialog. */
export async function open(path?: string) {
  if (path) return load(path)
  try {
    const info = await api.openRepositoryDialog()
    await load(info.path)
  } catch (e) {
    if ((e as ApiError).kind !== 'cancelled') repo.error = (e as ApiError).display
  }
}

/** Reloads refs and history of the open repository. */
export async function refresh() {
  if (repo.info) await load(repo.info.path)
}

export async function loadRecent() {
  try {
    repo.recent = await api.recentRepositories()
  } catch {
    /* recent list is a convenience, never an error */
  }
}

export async function forget(path: string) {
  await api.forgetRepository(path)
  await loadRecent()
}

/**
 * The backend can lose the open repository under us: a Go rebuild in dev
 * restarts it empty, another window may open something else. When a call
 * comes back "not open", re-open and reload once instead of showing errors
 * everywhere.
 */
let recovering: Promise<void> | null = null
export function recoverIfNotOpen(e: unknown): boolean {
  const err = e as ApiError
  if (err?.kind !== 'object_not_found' || !/is not open$/.test(err.message)) return false
  if (!repo.info || recovering) return !!recovering
  recovering = refresh().finally(() => { recovering = null })
  return true
}

export function subscribeRepoEvents() {
  events.onHistoryChunk(({ loadId, rows }) => {
    if (loadId !== repo.loadId) return
    const start = repo.commits.length
    let maxLanes = repo.maxLanes
    for (let i = 0; i < rows.length; i++) {
      const c = rows[i]
      byHash.set(c.hash, c)
      position.set(c.hash, start + i)
      if (c.row.lanes > maxLanes) maxLanes = c.row.lanes
    }
    repo.commits = repo.commits.concat(rows)
    repo.maxLanes = maxLanes
  })
  events.onHistoryDone(({ loadId }) => {
    if (loadId !== repo.loadId) return
    repo.loading = false
  })
  events.onHistoryError(({ loadId, message }) => {
    if (loadId !== repo.loadId) return
    repo.loading = false
    repo.error = new ApiError(message).display
  })
  events.onRepoChanged((root) => {
    if (repo.info?.path === root) repo.changedSinceLoad = true
  })
}
