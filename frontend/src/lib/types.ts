// Plain types mirroring the Go JSON. The generated wailsjs classes are
// awkward to use in React state, so everything downstream uses these.

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

export interface Touch {
  commit: string
  type: ChangeType
  path: string
  oldPath?: string
  additions: number
  deletions: number
  binary: boolean
}

export interface FileChange {
  path: string
  oldPath?: string
  type: ChangeType
  additions: number
  deletions: number
  binary: boolean
  touches: Touch[]
  composable: boolean
}

export interface ChangeSet {
  hashes: string[]
  merges: string[]
  files: FileChange[]
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
