import { describe, expect, it } from 'vitest'
import { buildTree, filterFiles, flatten, visibleFilePaths } from './fileTree'
import type { FileChange } from './types'

function fc(path: string, type: FileChange['type'] = 'modified'): FileChange {
  return { path, type, additions: 1, deletions: 0, binary: false, touches: [], composable: true }
}

describe('buildTree', () => {
  it('groups by directory and compacts single-child chains', () => {
    const tree = buildTree([fc('src/main/java/App.java'), fc('src/main/java/Util.java'), fc('README.md')])
    expect(tree.map((n) => n.name)).toEqual(['src/main/java', 'README.md'])
    const dir = tree[0]
    if (dir.kind !== 'dir') throw new Error()
    expect(dir.path).toBe('src/main/java')
    expect(dir.children.map((c) => c.name)).toEqual(['App.java', 'Util.java'])
    expect(dir.fileCount).toBe(2)
  })
  it('does not compact a directory that has files of its own', () => {
    const tree = buildTree([fc('a/b/c.txt'), fc('a/d.txt')])
    expect(tree[0].name).toBe('a')
    if (tree[0].kind !== 'dir') throw new Error()
    expect(tree[0].children.map((c) => c.name)).toEqual(['b', 'd.txt'])
  })
  it('sorts dirs first, then by type when asked', () => {
    const tree = buildTree([fc('z.txt', 'added'), fc('a.txt', 'deleted'), fc('m.txt', 'modified'), fc('dir/x')], 'type')
    expect(tree.map((n) => n.name)).toEqual(['dir', 'z.txt', 'm.txt', 'a.txt'])
  })
})

describe('flatten', () => {
  it('skips collapsed directories and lists files in order', () => {
    const tree = buildTree([fc('a/one'), fc('a/two'), fc('b/three'), fc('four')])
    const rows = flatten(tree, new Set(['a']))
    expect(rows.map((r) => `${r.depth}:${r.node.name}`)).toEqual(['0:a', '0:b', '1:three', '0:four'])
    expect(visibleFilePaths(rows)).toEqual(['b/three', 'four'])
  })
})

describe('filterFiles', () => {
  it('matches path and old path, case-insensitively', () => {
    const files = [fc('src/App.tsx'), { ...fc('new.ts', 'renamed'), oldPath: 'OLD.ts' }]
    expect(filterFiles(files, 'app').map((f) => f.path)).toEqual(['src/App.tsx'])
    expect(filterFiles(files, 'old').map((f) => f.path)).toEqual(['new.ts'])
    expect(filterFiles(files, '  ')).toHaveLength(2)
  })
})
