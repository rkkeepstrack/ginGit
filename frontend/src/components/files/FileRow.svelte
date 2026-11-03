<script lang="ts">
  import Unlink from '@lucide/svelte/icons/unlink'
  import { changeMark } from '../../lib/changeType'
  import { categoryFor, iconFor } from '../../lib/fileIcon'
  import type { FileChange } from '../../lib/types'
  import { hint } from '../../state/hint.svelte'

  let { change, name, depth, active, onclick }: { change: FileChange; name: string; depth: number; active: boolean; onclick: () => void } = $props()
  const Icon = $derived(iconFor(change.path))
  const mark = $derived(changeMark[change.type])
</script>

<div
  class="tree-row flex items-center gap-1.5 pr-2"
  class:active
  style:padding-left="{6 + depth * 14 + 17}px"
  {onclick}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onclick() } }}
  role="button"
  tabindex="0"
  title={change.oldPath ? `${change.oldPath} → ${change.path}` : change.path}
>
  <Icon size={14} strokeWidth={1.75} class="shrink-0 opacity-80 ft-{categoryFor(change.path)}" />
  <span class="truncate fn-{change.type}">{name}</span>
  {#if mark}<span class="ct ct-{change.type}">{mark.letter}</span>{/if}
  {#if change.oldPath}<span class="opacity-40 truncate text-[10px]">← {change.oldPath.split('/').pop()}</span>{/if}
  {#if change.touches.length > 1}<span class="text-[10.5px] opacity-50 tabular-nums shrink-0" use:hint={`Changed in ${change.touches.length} selected commits`}>×{change.touches.length}</span>{/if}
  {#if !change.composable}<Unlink size={12} strokeWidth={1.75} class="text-warning shrink-0" />{/if}
  <span class="flex-1"></span>
  {#if change.binary}
    <span class="opacity-40 text-[10px]">bin</span>
  {:else}
    <span class="text-[11px] tabular-nums shrink-0"><span class="stat-add">+{change.additions}</span> <span class="stat-del">−{change.deletions}</span></span>
  {/if}
</div>
