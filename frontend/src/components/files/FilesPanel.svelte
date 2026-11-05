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
  import { plural } from '../../lib/format'
  import { keys } from '../../lib/platform'
  import { activate } from '../../lib/shortcuts'
  import { visibleRange } from '../../lib/virtual'
  import { changes } from '../../state/changes.svelte'
  import { files, toggleDir } from '../../state/files.svelte'
  import { hint } from '../../state/hint.svelte'
  import { clear, selection, setFile } from '../../state/selection.svelte'
  import { ui } from '../../state/ui.svelte'
  import Notice from '../shell/Notice.svelte'
  import FileRow from './FileRow.svelte'
  import Stats from './Stats.svelte'

  const ROW = 24
  let scroller = $state<HTMLDivElement>()
  let scrollTop = $state(0)
  let height = $state(0)

  const rows = $derived(files.rows)
  const range = $derived(visibleRange(scrollTop, height, ROW, rows.length, 15))
  const totals = $derived.by(() => {
    let a = 0, d = 0
    for (const f of changes.changeSet?.files ?? []) { a += f.additions; d += f.deletions }
    return { a, d }
  })
</script>

<div class="flex flex-col h-full min-h-0" id="files">
  <div class="panel-head hairline-b">
    <span class="font-medium tabular-nums shrink-0">{plural(selection.hashes.length, 'commit')}</span>
    <div class="flex-1"></div>
    <button class="btn btn-ghost btn-xs btn-square shrink-0" onclick={clear} use:hint={'Clear selection  Esc'}><X size={14} strokeWidth={1.75} /></button>
  </div>
  <div class="flex items-center gap-1 px-2 py-1 hairline-b shrink-0">
    <label class="input input-xs flex-1 min-w-0 flex items-center gap-1 text-[12px] pr-0.5">
      <input class="grow min-w-0" placeholder="Filter files  {keys('mod', 'E')}" bind:value={files.filter} />
      {#if files.filter}<button class="btn btn-ghost btn-xs btn-square h-4 min-h-0 w-4" onclick={() => (files.filter = '')} use:hint={'Clear filter'}><X size={12} strokeWidth={1.75} /></button>{/if}
    </label>
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
        {plural(changes.changeSet.files.length, 'file')} <Stats additions={totals.a} deletions={totals.d} />
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
      <div class="p-6 text-center opacity-50 text-xs">{files.filter ? 'No files match.' : 'No file changes.'}</div>
    {/if}
    <div style:height="{rows.length * ROW}px" class="relative">
      {#each rows.slice(range.start, range.end) as r, k (r.node.path)}
        <div class="absolute left-0 right-0" style:top="{(range.start + k) * ROW}px">
          {#if r.node.kind === 'dir'}
            {@const dir = r.node}
            {@const closed = files.collapsed.has(dir.path)}
            <div class="tree-row flex items-center gap-1 pr-2" style:padding-left="{6 + r.depth * 14}px" onclick={() => toggleDir(dir.path)} onkeydown={activate(() => toggleDir(dir.path))} role="button" tabindex="0">
              {#if closed}<ChevronRight size={13} strokeWidth={1.75} class="opacity-50 shrink-0" />{:else}<ChevronDown size={13} strokeWidth={1.75} class="opacity-50 shrink-0" />{/if}
              {#if closed}<Folder size={14} strokeWidth={1.75} class="opacity-55 shrink-0" />{:else}<FolderOpen size={14} strokeWidth={1.75} class="opacity-55 shrink-0" />{/if}
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
