import { buildTree, filterFiles, flatRows, flatten, visibleFilePaths } from '../lib/fileTree'
import type { FileChange } from '../lib/types'
import { changes } from './changes.svelte'
import { ui } from './ui.svelte'

/**
 * How the files panel shows the change set: filtered, sorted, as a tree or
 * flat. The review follows the same order, and so do [ and ].
 */
class FilesStore {
  filter = $state('')
  /** Collapsed directories of the tree view. */
  collapsed = $state.raw<Set<string>>(new Set())
  rows = $derived.by(() => {
    const files = filterFiles(changes.changeSet?.files ?? [], this.filter)
    return ui.flatFiles ? flatRows(files, ui.fileSort) : flatten(buildTree(files, ui.fileSort), this.collapsed)
  })
  /** The files on screen, top to bottom. */
  visible = $derived.by(() => {
    const byPath = new Map(changes.changeSet?.files.map((f) => [f.path, f]))
    return visibleFilePaths(this.rows).map((p) => byPath.get(p)).filter((f): f is FileChange => !!f)
  })
}

export const files = new FilesStore()

export function toggleDir(path: string) {
  const n = new Set(files.collapsed)
  n.has(path) ? n.delete(path) : n.add(path)
  files.collapsed = n
}
