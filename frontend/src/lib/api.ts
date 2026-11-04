// The only module that touches the generated Wails bindings and runtime.
import * as App from '../../wailsjs/go/main/App'
import { ClipboardSetText, EventsOn, WindowToggleMaximise } from '../../wailsjs/runtime/runtime'
import type { ChangeSet, Commit, DiffResult, RecentRepo, Ref, RepoInfo } from './types'

const kinds = ['not_a_repository', 'git_not_found', 'timeout', 'object_not_found', 'cancelled'] as const
export type ErrorKind = (typeof kinds)[number] | 'unknown'

/** Go prefixes known failures with "kind: "; everything else is unknown. */
export class ApiError extends Error {
  kind: ErrorKind
  constructor(message: string) {
    super(message)
    const m = /^([a-z_]+): /.exec(message)
    this.kind = (kinds as readonly string[]).includes(m?.[1] ?? '') ? (m![1] as ErrorKind) : 'unknown'
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

const zeroTime = '0001-01-01T00:00:00Z'

export const api = {
  initialRepository: () => wrap(App.InitialRepository()),
  titleBarCenter: () => wrap(App.TitleBarCenter()),
  openRepository: (path: string) => wrap(App.OpenRepository(path)) as Promise<RepoInfo>,
  openRepositoryDialog: () => wrap(App.OpenRepositoryDialog()) as Promise<RepoInfo>,
  recentRepositories: () => wrap(App.RecentRepositories()) as Promise<RecentRepo[]>,
  forgetRepository: (path: string) => wrap(App.ForgetRepository(path)),
  refs: (root: string) => wrap(App.Refs(root)) as Promise<Ref[]>,
  branchCommits: (root: string, ref: string) => wrap(App.BranchCommits(root, ref)) as Promise<string[]>,
  nameCommits: (root: string, hashes: string[]) => wrap(App.NameCommits(root, hashes)) as Promise<Record<string, string>>,
  loadHistory: (root: string, loadId: number) => wrap(App.LoadHistory(root, loadId)),
  listChanges: (root: string, hashes: string[]) =>
    wrap(App.ListChanges(root, hashes)) as unknown as Promise<ChangeSet>,
  fileDiffs: (root: string, hashes: string[], paths: string[]) =>
    wrap(App.FileDiffs(root, hashes, paths)) as unknown as Promise<Record<string, DiffResult>>,
  markReviewed: (root: string, hashes: string[], path: string, seen: boolean) => wrap(App.MarkReviewed(root, hashes, path, seen)),
  fileDiffSince: (root: string, hashes: string[], path: string) =>
    wrap(App.FileDiffSince(root, hashes, path)) as unknown as Promise<DiffResult>,
  searchChanges: (root: string, hashes: string[], text: string) =>
    wrap(App.SearchChanges(root, hashes, text)) as Promise<Record<string, number>>,
  searchCommits: (root: string, text: string) =>
    wrap(App.SearchCommits(root, { text, author: '', branch: '', since: zeroTime, until: zeroTime } as never)) as Promise<number[]>,
}

export const runtime = {
  setClipboard: (text: string) => ClipboardSetText(text),
  toggleMaximise: () => WindowToggleMaximise(),
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
