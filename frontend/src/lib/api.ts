// The only module that touches the generated Wails bindings.
import * as App from '../../wailsjs/go/main/App'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import type { ChangeSet, Commit, DiffResult, Mode, RecentRepo, Ref, RepoInfo, SearchQuery } from './types'

export type ErrorKind =
  | 'not_a_repository' | 'git_not_found' | 'timeout' | 'object_not_found'
  | 'not_contiguous' | 'cancelled' | 'unknown'

export class ApiError extends Error {
  kind: ErrorKind
  constructor(message: string) {
    super(message)
    const m = /^([a-z_]+): /.exec(message)
    this.kind = (m ? m[1] : 'unknown') as ErrorKind
    if (!['not_a_repository', 'git_not_found', 'timeout', 'object_not_found', 'not_contiguous', 'cancelled'].includes(this.kind)) {
      this.kind = 'unknown'
    }
  }
  get display(): string {
    return this.message.replace(/^[a-z_]+: /, '')
  }
}

async function wrap<T>(p: Promise<T>): Promise<T> {
  try {
    return await p
  } catch (e) {
    throw new ApiError(typeof e === 'string' ? e : (e as Error)?.message ?? String(e))
  }
}

export const api = {
  gitVersion: () => wrap(App.GitVersion()),
  initialRepository: () => wrap(App.InitialRepository()),
  openRepository: (path: string) => wrap(App.OpenRepository(path)) as Promise<RepoInfo>,
  openRepositoryDialog: () => wrap(App.OpenRepositoryDialog()) as Promise<RepoInfo>,
  recentRepositories: () => wrap(App.RecentRepositories()) as Promise<RecentRepo[]>,
  forgetRepository: (path: string) => wrap(App.ForgetRepository(path)),
  refs: (root: string) => wrap(App.Refs(root)) as Promise<Ref[]>,
  loadHistory: (root: string, loadId: number) => wrap(App.LoadHistory(root, loadId)),
  cancelHistory: (id: number) => wrap(App.CancelHistory(id)),
  listChanges: (root: string, hashes: string[], mode: Mode) =>
    wrap(App.ListChanges(root, hashes, mode)) as unknown as Promise<ChangeSet>,
  fileDiff: (root: string, hashes: string[], mode: Mode, path: string) =>
    wrap(App.FileDiff(root, hashes, mode, path)) as unknown as Promise<DiffResult>,
  searchCommits: (root: string, q: SearchQuery) =>
    wrap(App.SearchCommits(root, q as never)) as Promise<number[]>,
}

export interface HistoryChunk { loadId: number; rows: Commit[] }
export interface HistoryDone { loadId: number; total: number }
export interface HistoryError { loadId: number; message: string }

export const events = {
  onHistoryChunk: (cb: (c: HistoryChunk) => void) => EventsOn('history:chunk', cb),
  onHistoryDone: (cb: (d: HistoryDone) => void) => EventsOn('history:done', cb),
  onHistoryError: (cb: (e: HistoryError) => void) => EventsOn('history:error', cb),
  onRepoChanged: (cb: (root: string) => void) => EventsOn('repo:changed', cb),
  onMenu: (cb: (action: string) => void) => EventsOn('menu', cb),
}
