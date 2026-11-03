import type { FileChange } from './types'

export interface DirNode {
  kind: 'dir'
  /** Display name; may be a compacted chain like "src/main/java". */
  name: string
  path: string
  children: TreeNode[]
  fileCount: number
}
export interface FileNode { kind: 'file'; name: string; path: string; change: FileChange }
export type TreeNode = DirNode | FileNode

export type SortKey = 'name' | 'type'

const typeOrder: Record<string, number> = { added: 0, modified: 1, renamed: 2, deleted: 3 }

function sortNodes(nodes: TreeNode[], sort: SortKey): TreeNode[] {
  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
    if (sort === 'type' && a.kind === 'file' && b.kind === 'file') {
      const d = typeOrder[a.change.type] - typeOrder[b.change.type]
      if (d !== 0) return d
    }
    return a.name.localeCompare(b.name)
  })
}

/**
 * Builds a directory tree, compacting single-child directory chains the way
 * IDEs do ("src/main/java" as one node).
 */
export function buildTree(files: FileChange[], sort: SortKey = 'name'): TreeNode[] {
  interface Raw { dirs: Map<string, Raw>; files: FileChange[] }
  const root: Raw = { dirs: new Map(), files: [] }
  for (const f of files) {
    const parts = f.path.split('/')
    let cur = root
    for (const p of parts.slice(0, -1)) {
      let next = cur.dirs.get(p)
      if (!next) {
        next = { dirs: new Map(), files: [] }
        cur.dirs.set(p, next)
      }
      cur = next
    }
    cur.files.push(f)
  }
  const convert = (raw: Raw, prefix: string): TreeNode[] => {
    const nodes: TreeNode[] = []
    for (const [name, sub] of raw.dirs) {
      let label = name
      let path = prefix ? `${prefix}/${name}` : name
      let node = sub
      while (node.files.length === 0 && node.dirs.size === 1) {
        const [childName, child] = [...node.dirs][0]
        label = `${label}/${childName}`
        path = `${path}/${childName}`
        node = child
      }
      const children = convert(node, path)
      nodes.push({ kind: 'dir', name: label, path, children, fileCount: countFiles(children) })
    }
    for (const f of raw.files) {
      nodes.push({ kind: 'file', name: f.path.split('/').pop()!, path: f.path, change: f })
    }
    return sortNodes(nodes, sort)
  }
  return convert(root, '')
}

function countFiles(nodes: TreeNode[]): number {
  return nodes.reduce((n, c) => n + (c.kind === 'file' ? 1 : c.fileCount), 0)
}

export interface FlatRow { node: TreeNode; depth: number }

/** The same files as a flat list, sorted the way the tree sorts its leaves. */
export function flatRows(files: FileChange[], sort: SortKey): FlatRow[] {
  const nodes: TreeNode[] = files.map((f) => ({ kind: 'file', name: f.path, path: f.path, change: f }))
  return sortNodes(nodes, sort).map((node) => ({ node, depth: 0 }))
}

/** Flattens the tree for virtualization, skipping collapsed directories. */
export function flatten(nodes: TreeNode[], collapsed: Set<string>, depth = 0, out: FlatRow[] = []): FlatRow[] {
  for (const n of nodes) {
    out.push({ node: n, depth })
    if (n.kind === 'dir' && !collapsed.has(n.path)) flatten(n.children, collapsed, depth + 1, out)
  }
  return out
}

export function filterFiles(files: FileChange[], query: string): FileChange[] {
  const q = query.trim().toLowerCase()
  if (!q) return files
  return files.filter((f) => f.path.toLowerCase().includes(q) || (f.oldPath ?? '').toLowerCase().includes(q))
}

/** Files in tree display order, for prev/next navigation. */
export function visibleFilePaths(rows: FlatRow[]): string[] {
  return rows.filter((r) => r.node.kind === 'file').map((r) => r.node.path)
}
