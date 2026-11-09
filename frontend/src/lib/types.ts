// Plain types mirroring the Go JSON. The generated wailsjs classes are
// awkward to hold in stores, so everything downstream uses these.

export interface Segment { from: number; to: number; color: number }
export interface Row { lane: number; color: number; segments: Segment[]; lanes: number }

export interface Commit {
  hash: string
  parents: string[]
  author: string
  authorEmail: string
  authorDate: string
  commitDate: string
  subject: string
  row: Row
}

export interface RepoInfo {
  path: string
  name: string
  branch: string
  head: string
}

export interface Ref {
  name: string
  full: string
  hash: string
  kind: 'head' | 'remote' | 'tag'
  isHead: boolean
}

export interface RecentRepo { path: string; name: string; lastOpen: string }

export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed'

export interface FileChange {
  path: string
  oldPath?: string
  type: ChangeType
  additions: number
  deletions: number
  binary: boolean
  /** How many selected commits changed it. */
  touchCount: number
  composable: boolean
  /** Whether the user has seen this version ("reviewed"), an older one ("stale"), or none (""). */
  review: '' | 'reviewed' | 'stale'
}

export interface ChangeSet {
  hashes: string[]
  merges: string[]
  files: FileChange[]
  /** Commit messages below the subject, for the commits that have one. */
  bodies: Record<string, string>
  /** Review marks apply: the newest selected commit is not on the default branch yet. */
  reviewable: boolean
}

export interface Side {
  blob: string
  path: string
  content: string
  size: number
  missing: boolean
  binary: boolean
  tooLarge: boolean
}

export interface Pair { commit: string; type: ChangeType; old: Side; new: Side }

export interface DiffResult {
  path: string
  type: ChangeType
  stacked: boolean
  note?: string
  pairs: Pair[]
}
