<script lang="ts">
  import ChevronsDownUp from '@lucide/svelte/icons/chevrons-down-up'
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down'
  import type { FileChange } from '../../lib/types'
  import { changes } from '../../state/changes.svelte'
  import { hint } from '../../state/hint.svelte'
  import { selection } from '../../state/selection.svelte'
  import FileSection from './FileSection.svelte'

  // Every changed file, one collapsible section each, in the files panel's order.
  const files = $derived.by(() => {
    const byPath = new Map(changes.changeSet?.files.map((f) => [f.path, f]))
    return changes.paths.map((p) => byPath.get(p)).filter((f): f is FileChange => !!f)
  })
  let collapsed = $state.raw<Set<string>>(new Set())
  let scroller = $state<HTMLDivElement>()
  const allCollapsed = $derived(collapsed.size >= files.length && files.length > 0)

  const toggle = (path: string) => {
    const n = new Set(collapsed)
    n.has(path) ? n.delete(path) : n.add(path)
    collapsed = n
  }
</script>

<div class="flex flex-col h-full min-h-0" id="panel-diff">
  <div class="panel-head hairline-b">
    <span class="font-medium tabular-nums">{files.length} {files.length === 1 ? 'file' : 'files'}</span>
    <div class="flex-1"></div>
    <button class="btn btn-ghost btn-xs btn-square" onclick={() => (collapsed = allCollapsed ? new Set() : new Set(files.map((f) => f.path)))} use:hint={allCollapsed ? 'Expand all files' : 'Collapse all files'}>
      {#if allCollapsed}<ChevronsUpDown size={15} strokeWidth={1.75} />{:else}<ChevronsDownUp size={15} strokeWidth={1.75} />{/if}
    </button>
  </div>
  <div bind:this={scroller} class="flex-1 overflow-auto">
    {#each files as f (f.path)}
      <FileSection file={f} hashes={selection.hashes} collapsed={collapsed.has(f.path)} ontoggle={() => toggle(f.path)} scrollRoot={scroller} />
    {/each}
  </div>
</div>
