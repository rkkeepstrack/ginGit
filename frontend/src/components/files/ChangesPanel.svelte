<script lang="ts">
  import ArrowDownAZ from '@lucide/svelte/icons/arrow-down-a-z'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import Folder from '@lucide/svelte/icons/folder'
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import GitMerge from '@lucide/svelte/icons/git-merge'
  import List from '@lucide/svelte/icons/list'
  import ListTree from '@lucide/svelte/icons/list-tree'
  import Tags from '@lucide/svelte/icons/tags'
  import X from '@lucide/svelte/icons/x'
  import { buildTree, filterFiles, flatRows, flatten, visibleFilePaths } from '../../lib/fileTree'
  import { visibleRange } from '../../lib/virtual'
  import { changes } from '../../state/changes.svelte'
  import { hint } from '../../state/hint.svelte'
  import { clear, selection, setFile } from '../../state/selection.svelte'
  import { ui } from '../../state/ui.svelte'
  import Notice from '../shell/Notice.svelte'
  import FileRow from './FileRow.svelte'

  const ROW = 24
  let filter = $state('')
  let collapsed = $state.raw<Set<string>>(new Set())
  let scroller = $state<HTMLDivElement>()
  let scrollTop = $state(0)
  let height = $state(0)

  const count = $derived(selection.selected.size)
  const files = $derived(filterFiles(changes.changeSet?.files ?? [], filter))
  const rows = $derived(ui.flatFiles ? flatRows(files, ui.fileSort) : flatten(buildTree(files, ui.fileSort), collapsed))
  $effect(() => {
    const next = visibleFilePaths(rows)
    const same = next.length === changes.paths.length && next.every((p, i) => p === changes.paths[i])
    if (!same) changes.paths = next
  })
  const range = $derived(visibleRange(scrollTop, height, ROW, rows.length, 15))
  const totals = $derived.by(() => {
    let a = 0, d = 0
    for (const f of changes.changeSet?.files ?? []) { a += f.additions; d += f.deletions }
    return { a, d }
  })

  const toggleDir = (path: string) => {
    const n = new Set(collapsed)
    n.has(path) ? n.delete(path) : n.add(path)
    collapsed = n
  }
</script>

<div class="flex flex-col h-full min-h-0" id="panel-files">
  <div class="panel-head hairline-b">
    <span class="font-medium tabular-nums shrink-0">{count} {count === 1 ? 'commit' : 'commits'}</span>
    <div class="flex-1"></div>
    <button class="btn btn-ghost btn-xs btn-square shrink-0" onclick={clear} use:hint={'Clear selection  Esc'}><X size={14} strokeWidth={1.75} /></button>
  </div>
  <div class="flex items-center gap-1 px-2 py-1 hairline-b shrink-0">
    <input class="input input-xs flex-1 min-w-0 text-[12px]" placeholder="Filter files" bind:value={filter} />
    <button class="btn btn-ghost btn-xs btn-square shrink-0" onclick={() => (ui.fileSort = ui.fileSort === 'name' ? 'type' : 'name')} use:hint={ui.fileSort === 'name' ? 'Sorted by name, click to sort by change type' : 'Sorted by change type, click to sort by name'}>
      {#if ui.fileSort === 'name'}<ArrowDownAZ size={15} strokeWidth={1.75} />{:else}<Tags size={15} strokeWidth={1.75} />{/if}
    </button>
    <button class="btn btn-ghost btn-xs btn-square shrink-0" onclick={() => (ui.flatFiles = !ui.flatFiles)} use:hint={ui.flatFiles ? 'Show as tree' : 'Show as flat list'}>
      {#if ui.flatFiles}<ListTree size={15} strokeWidth={1.75} />{:else}<List size={15} strokeWidth={1.75} />{/if}
    </button>
  </div>
  {#if changes.changeSet}
    <div class="flex items-center gap-2 px-2 h-7 text-[11.5px] opacity-70 hairline-b shrink-0 whitespace-nowrap overflow-hidden">
      <span class="tabular-nums shrink-0">
        {changes.changeSet.files.length} {changes.changeSet.files.length === 1 ? 'file' : 'files'} <span class="stat-add">+{totals.a}</span> <span class="stat-del">−{totals.d}</span>
      </span>
      <div class="flex-1"></div>
      {#if changes.changeSet.merges.length > 0}
        <span class="inline-flex items-center gap-1 shrink-0" use:hint={'Merge commits are diffed against their first parent: what the merge brought into the branch'}>
          <GitMerge size={12} strokeWidth={1.75} /> {changes.changeSet.merges.length}
        </span>
      {/if}
    </div>
  {/if}
  {#if changes.error}<Notice kind="error">{changes.error}</Notice>{/if}
  <div bind:this={scroller} bind:clientHeight={height} onscroll={() => { scrollTop = scroller?.scrollTop ?? 0 }} class="flex-1 overflow-auto">
    {#if changes.changeSet && rows.length === 0 && !changes.loading}
      <div class="p-6 text-center opacity-50 text-xs">{filter ? 'No files match.' : 'No file changes.'}</div>
    {/if}
    <div style:height="{rows.length * ROW}px" class="relative">
      {#each rows.slice(range.start, range.end) as r, k (r.node.path)}
        <div class="absolute left-0 right-0" style:top="{(range.start + k) * ROW}px">
          {#if r.node.kind === 'dir'}
            {@const dir = r.node}
            <div class="tree-row flex items-center gap-1 pr-2" style:padding-left="{6 + r.depth * 14}px" onclick={() => toggleDir(dir.path)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDir(dir.path) } }} role="button" tabindex="0">
              {#if collapsed.has(dir.path)}<ChevronRight size={13} strokeWidth={1.75} class="opacity-50 shrink-0" />{:else}<ChevronDown size={13} strokeWidth={1.75} class="opacity-50 shrink-0" />{/if}
              {#if collapsed.has(dir.path)}<Folder size={14} strokeWidth={1.75} class="opacity-55 shrink-0" />{:else}<FolderOpen size={14} strokeWidth={1.75} class="opacity-55 shrink-0" />{/if}
              <span class="truncate opacity-85">{dir.name}</span>
              <span class="opacity-40 text-[10.5px] tabular-nums">{dir.fileCount}</span>
            </div>
          {:else}
            {@const file = r.node}
            <FileRow change={file.change} name={file.name} depth={r.depth} active={selection.file === file.path} onclick={() => setFile(file.path)} />
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>
