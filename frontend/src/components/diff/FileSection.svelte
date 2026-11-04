<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import History from '@lucide/svelte/icons/history'
  import Unlink from '@lucide/svelte/icons/unlink'
  import ReviewMark from '../files/ReviewMark.svelte'
  import { changes, markReviewed } from '../../state/changes.svelte'
  import { api } from '../../lib/api'
  import { repo } from '../../state/repo.svelte'
  import { selection } from '../../state/selection.svelte'
  import { changeMark } from '../../lib/changeType'
  import { categoryFor, iconFor } from '../../lib/fileIcon'
  import type { DiffResult, FileChange } from '../../lib/types'
  import { hint } from '../../state/hint.svelte'
  import { ui } from '../../state/ui.svelte'
  import Notice from '../shell/Notice.svelte'
  import DiffBody from './DiffBody.svelte'

  let { file, collapsed, flashed = false, result, error, ontoggle, onnear, onmarked, scrollRoot }: {
    file: FileChange
    collapsed: boolean
    /** Briefly true after the file was picked in the tree, to show where it landed. */
    flashed?: boolean
    result: DiffResult | null
    error: string | null
    ontoggle: () => void
    /** Called once when the section comes within reach; the parent fetches in batches. */
    onnear: () => void
    /** Called after a file was marked reviewed, so the parent can fold it. */
    onmarked: () => void
    scrollRoot: HTMLElement | undefined
  } = $props()

  async function mark(seen: boolean) {
    await markReviewed(file.path, seen)
    if (seen) onmarked()
  }

  // For a stale file: the change since the reviewed version instead of the whole diff.
  let since = $state(false)
  let sinceResult = $state.raw<DiffResult | null>(null)
  $effect(() => {
    if (!since || file.review !== 'stale' || !repo.info) { sinceResult = null; return }
    const root = repo.info.path
    api.fileDiffSince(root, selection.hashes, file.path).then((r) => { sinceResult = r }, () => { since = false })
  })

  let el = $state<HTMLDivElement>()
  let near = $state(false)
  const Icon = $derived(iconFor(file.path))
  const typeMark = $derived(changeMark[file.type])

  // Only fetch once the section is within a screen or so of the viewport.
  $effect(() => {
    if (!el || near) return
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) near = true }, { root: scrollRoot, rootMargin: '300px 0px' })
    io.observe(el)
    return () => io.disconnect()
  })
  $effect(() => { if (near && !collapsed) onnear() })
  // A placeholder roughly the size of the diff keeps later sections from
  // cascading as editors appear; skeleton lines make it read as content on its way.
  const placeholderLines = $derived(Math.max(3, Math.min(24, file.additions + file.deletions + 4)))

</script>

<div bind:this={el} class="section" class:flashed data-path={file.path}>
  <div
    class="section-head flex items-center gap-2 px-2 h-9 text-[12px] sticky top-0 z-10 select-none"
    class:open={!collapsed}
    class:reviewed={file.review === 'reviewed'}
    class:stale={file.review === 'stale'}
    onclick={ontoggle}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ontoggle() } else if (e.key === 'v') { e.preventDefault(); void mark(file.review !== 'reviewed') } }}
    role="button"
    tabindex="0"
    use:hint={collapsed ? 'Expand' : 'Collapse'}
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
    {#if typeMark}<span class="ct-{file.type} text-[11px] font-medium shrink-0">{typeMark.label}</span>{/if}
    {#if file.review === 'stale'}
      <button type="button" class="btn btn-ghost btn-xs" class:btn-active={since} onmousedown={(e) => e.stopPropagation()} onclick={(e) => { e.stopPropagation(); since = !since }} use:hint={since ? 'Show the whole diff' : 'Show only what changed since you reviewed it'}>
        <History size={13} strokeWidth={1.75} /> since
      </button>
    {/if}
    {#if changes.changeSet?.reviewable}<ReviewMark review={file.review} onmark={mark} />{/if}
  </div>
  {#if !collapsed}
    <div>
      {#if error}<Notice kind="error">{error}</Notice>{/if}
      {#if !result && !error}
        <div class="skeleton-lines px-3 py-2" aria-busy="true">
          {#each { length: placeholderLines } as _, i}
            <div class="skeleton-line" style:width="{[62, 38, 74, 46, 58, 30, 68][i % 7]}%"></div>
          {/each}
        </div>
      {/if}
      {#if since && sinceResult}
        <DiffBody result={sinceResult} path={file.path} mode={ui.diffMode} stacked={true} />
      {:else if result}
        <DiffBody result={result} path={file.path} mode={ui.diffMode} stacked={true} />
      {/if}
    </div>
  {/if}
</div>
