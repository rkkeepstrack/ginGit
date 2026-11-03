<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import Unlink from '@lucide/svelte/icons/unlink'
  import { changeMark } from '../../lib/changeType'
  import { categoryFor, iconFor } from '../../lib/fileIcon'
  import type { FileChange } from '../../lib/types'
  import { hint } from '../../state/hint.svelte'
  import { repo } from '../../state/repo.svelte'
  import { setFile } from '../../state/selection.svelte'
  import { ui } from '../../state/ui.svelte'
  import Notice from '../shell/Notice.svelte'
  import DiffBody from './DiffBody.svelte'
  import { FileDiff } from './fileDiff.svelte'

  let { file, hashes, collapsed, ontoggle, scrollRoot }: { file: FileChange; hashes: string[]; collapsed: boolean; ontoggle: () => void; scrollRoot: HTMLElement | undefined } = $props()

  let el = $state<HTMLDivElement>()
  let near = $state(false)
  const diff = new FileDiff()
  const Icon = $derived(iconFor(file.path))
  const mark = $derived(changeMark[file.type])

  // Only fetch once the section is within a screen or so of the viewport.
  $effect(() => {
    if (!el || near) return
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) near = true }, { root: scrollRoot, rootMargin: '300px 0px' })
    io.observe(el)
    return () => io.disconnect()
  })
  $effect(() => { diff.watch(repo.info?.path, hashes, file.path, near && !collapsed) })
  // A placeholder roughly the size of the diff keeps later sections from
  // cascading as editors appear; skeleton lines make it read as content on its way.
  const placeholderLines = $derived(Math.max(3, Math.min(24, file.additions + file.deletions + 4)))

  const openSingle = () => setFile(file.path)
</script>

<div bind:this={el} class="section">
  <div
    class="section-head flex items-center gap-2 px-2 h-9 text-[12px] sticky top-0 z-10 select-none"
    class:open={!collapsed}
    onclick={ontoggle}
    ondblclick={openSingle}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ontoggle() } }}
    role="button"
    tabindex="0"
    use:hint={'Click to collapse, double-click to open this file on its own'}
  >
    {#if collapsed}<ChevronRight size={14} strokeWidth={1.75} class="opacity-50 shrink-0" />{:else}<ChevronDown size={14} strokeWidth={1.75} class="opacity-50 shrink-0" />{/if}
    <Icon size={14} strokeWidth={1.75} class="shrink-0 opacity-80 ft-{categoryFor(file.path)}" />
    <span class="truncate select-text fn-{file.type}" title={file.path}>
      {#if file.oldPath}<span class="opacity-50">{file.oldPath} → </span>{/if}{file.path}
    </span>
    {#if file.touchCount > 1}<span class="opacity-50 text-[10.5px] tabular-nums shrink-0" use:hint={`Changed in ${file.touchCount} selected commits`}>×{file.touchCount}</span>{/if}
    {#if !file.composable}<Unlink size={12} strokeWidth={1.75} class="text-warning shrink-0" />{/if}
    <div class="flex-1"></div>
    {#if file.binary}
      <span class="opacity-40 text-[10.5px]">binary</span>
    {:else}
      <span class="text-[11px] tabular-nums shrink-0"><span class="stat-add">+{file.additions}</span> <span class="stat-del">−{file.deletions}</span></span>
    {/if}
    {#if mark}<span class="ct-{file.type} text-[11px] font-medium shrink-0">{mark.label}</span>{/if}
  </div>
  {#if !collapsed}
    <div>
      {#if diff.error}<Notice kind="error">{diff.error}</Notice>{/if}
      {#if !diff.result && !diff.error}
        <div class="skeleton-lines px-3 py-2" aria-busy="true">
          {#each { length: placeholderLines } as _, i}
            <div class="skeleton-line" style:width="{[62, 38, 74, 46, 58, 30, 68][i % 7]}%"></div>
          {/each}
        </div>
      {/if}
      {#if diff.result}<DiffBody result={diff.result} path={file.path} mode={ui.diffMode} stacked={true} />{/if}
    </div>
  {/if}
</div>
