<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import Unlink from '@lucide/svelte/icons/unlink'
  import ReviewMark from '../files/ReviewMark.svelte'
  import { changes, markReviewed } from '../../state/changes.svelte'
  import { api } from '../../lib/api'
  import { repo } from '../../state/repo.svelte'
  import { selection } from '../../state/selection.svelte'
  import { changeMark } from '../../lib/changeType'
  import { fileIcon } from '../../lib/fileIcon'
  import { activate } from '../../lib/shortcuts'
  import type { DiffResult, FileChange } from '../../lib/types'
  import { hint } from '../../state/hint.svelte'
  import { ui } from '../../state/ui.svelte'
  import Notice from '../shell/Notice.svelte'
  import Stats from '../files/Stats.svelte'
  import DiffBody from './DiffBody.svelte'

  let { file, collapsed, current = false, result, error, ontoggle, onnear, onmarked, scrollRoot }: {
    file: FileChange
    collapsed: boolean
    /** The file picked in the tree; its header stays tinted so the eye finds it. */
    current?: boolean
    result: DiffResult | null
    error: string | null
    ontoggle: () => void
    /** Called once when the entry comes within reach; the parent fetches in batches. */
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
    let stale = false
    api.fileDiffSince(repo.info.path, selection.hashes, file.path).then((r) => { if (!stale) sinceResult = r }, () => { if (!stale) since = false })
    return () => { stale = true }
  })

  let el = $state<HTMLDivElement>()
  let near = $state(false)
  const { Icon, category } = $derived(fileIcon(file.path))
  const typeMark = $derived(changeMark[file.type])
  const onKey = activate(() => ontoggle())

  // Only fetch once the entry is within a screen or so of the viewport.
  $effect(() => {
    if (!el || near) return
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) near = true }, { root: scrollRoot, rootMargin: '300px 0px' })
    io.observe(el)
    return () => io.disconnect()
  })
  $effect(() => { if (near && !collapsed) onnear() })
  // A placeholder roughly the size of the diff keeps later entries from
  // cascading as editors appear; skeleton lines make it read as content on its way.
  const placeholderLines = $derived(Math.max(3, Math.min(24, file.additions + file.deletions + 4)))

</script>

<div bind:this={el} class="entry" class:current data-path={file.path}>
  <div
    class="entry-head flex items-center gap-2 px-2 h-9 text-[12px] sticky top-0 z-10 select-none"
    class:open={!collapsed}
    class:reviewed={file.review === 'reviewed'}
    class:stale={file.review === 'stale'}
    onclick={ontoggle}
    onkeydown={(e) => { if (e.key === 'v') { e.preventDefault(); void mark(file.review !== 'reviewed') } else onKey(e) }}
    role="button"
    tabindex="0"
    use:hint={collapsed ? 'Expand' : 'Collapse'}
  >
    {#if collapsed}<ChevronRight size={14} strokeWidth={1.75} class="opacity-50 shrink-0" />{:else}<ChevronDown size={14} strokeWidth={1.75} class="opacity-50 shrink-0" />{/if}
    <Icon size={14} strokeWidth={1.75} class="shrink-0 opacity-80 ft-{category}" />
    <span class="truncate select-text fn-{file.type}" title={file.path}>
      {#if file.oldPath}<span class="opacity-50">{file.oldPath} → </span>{/if}{file.path}
    </span>
    {#if file.touchCount > 1}<span class="opacity-50 text-[10.5px] tabular-nums shrink-0" use:hint={`Changed in ${file.touchCount} selected commits`}>×{file.touchCount}</span>{/if}
    {#if !file.composable}<Unlink size={12} strokeWidth={1.75} class="text-warning shrink-0" />{/if}
    <div class="flex-1"></div>
    {#if file.binary}
      <span class="opacity-40 text-[10.5px]">binary</span>
    {:else}
      <Stats additions={file.additions} deletions={file.deletions} />
    {/if}
    {#if typeMark}<span class="ct-label ct-{file.type}">{typeMark.label}</span>{/if}
    {#if file.review === 'stale'}
      <!-- Clicks stay here instead of folding the entry. -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
      <div role="tablist" class="tabs tabs-box tabs-xs p-0.5" onmousedown={(e) => e.stopPropagation()} onclick={(e) => e.stopPropagation()}>
        <button role="tab" class="tab px-1.5" class:tab-active={!since} class:brand={!since} class:opacity-60={since} onclick={() => (since = false)} use:hint={'The whole diff of the selection'}>All</button>
        <button role="tab" class="tab px-1.5" class:tab-active={since} class:brand={since} class:opacity-60={!since} onclick={() => (since = true)} use:hint={'Only what changed since you reviewed it'}>New</button>
      </div>
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
      {#if (since && sinceResult) || result}
        <DiffBody result={(since && sinceResult) || result!} path={file.path} mode={ui.diffMode} />
      {/if}
    </div>
  {/if}
</div>
