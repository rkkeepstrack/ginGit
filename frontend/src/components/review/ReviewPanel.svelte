<script lang="ts">
  import ChevronsDownUp from '@lucide/svelte/icons/chevrons-down-up'
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down'
  import { tick, untrack } from 'svelte'
  import { ApiError, api } from '../../lib/api'
  import { plural } from '../../lib/format'
  import type { DiffResult } from '../../lib/types'
  import { files } from '../../state/files.svelte'
  import { find } from '../../state/find.svelte'
  import { hint } from '../../state/hint.svelte'
  import { repo } from '../../state/repo.svelte'
  import { selection } from '../../state/selection.svelte'
  import FindBar from './FindBar.svelte'
  import ReviewEntry from './ReviewEntry.svelte'

  // Every changed file, one collapsible entry each, in the files panel's order.
  const entries = $derived(files.visible)
  // Reviewed files start folded; a mark folds its entry.
  let collapsed = $state.raw<Set<string>>(new Set(untrack(() => files.visible.filter((f) => f.review === 'reviewed').map((f) => f.path))))
  let scroller = $state<HTMLDivElement>()
  const allCollapsed = $derived(collapsed.size >= entries.length && entries.length > 0)
  const reviewed = $derived(entries.filter((f) => f.review === 'reviewed').length)
  const fold = (path: string) => { collapsed = new Set([...collapsed, path]) }

  // The file picked in the tree (or with [ and ]): open its entry and bring it to the top.
  // Only the pick drives this; reading the folds too would undo every later fold of that file.
  $effect(() => {
    const path = selection.file
    if (!path || !scroller) return
    untrack(() => {
      if (collapsed.has(path)) { const n = new Set(collapsed); n.delete(path); collapsed = n }
      want(path)
    })
    void tick().then(() => scroller?.querySelector(`[data-path="${CSS.escape(path)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  })
  // While a find is active, only files with a hit stay open, and they load.
  const isCollapsed = (path: string) => (find.counts ? !(path in find.counts) : collapsed.has(path))
  $effect(() => { if (find.counts) for (const path of Object.keys(find.counts)) want(path) })

  // Diffs are fetched for all entries that come into reach within the same
  // frame, in one bridge call and one git round, instead of one per entry.
  let results = $state.raw<Map<string, DiffResult>>(new Map())
  let errors = $state.raw<Map<string, string>>(new Map())
  const pending = new Set<string>()
  const requested = new Set<string>()
  let flush: ReturnType<typeof setTimeout> | undefined

  function want(path: string) {
    if (requested.has(path)) return
    requested.add(path)
    pending.add(path)
    clearTimeout(flush)
    flush = setTimeout(load, 16)
  }

  async function load() {
    const paths = [...pending]
    pending.clear()
    const root = repo.info?.path
    if (!root || paths.length === 0) return
    try {
      const got = await api.fileDiffs(root, selection.hashes, paths)
      results = new Map([...results, ...Object.entries(got)])
    } catch (e) {
      const message = (e as ApiError).display
      errors = new Map([...errors, ...paths.map((p) => [p, message] as const)])
    }
  }

  const toggle = (path: string) => {
    const n = new Set(collapsed)
    n.has(path) ? n.delete(path) : n.add(path)
    collapsed = n
  }
</script>

<div class="flex flex-col h-full min-h-0" id="review">
  <div class="panel-head hairline-b">
    <span class="font-medium tabular-nums">{plural(entries.length, 'file')}</span>
    {#if reviewed > 0}<span class="opacity-60 tabular-nums">{reviewed} of {entries.length} reviewed</span>{/if}
    <div class="flex-1"></div>
    <button class="btn btn-ghost btn-xs btn-square" onclick={() => (collapsed = allCollapsed ? new Set() : new Set(entries.map((f) => f.path)))} use:hint={allCollapsed ? 'Expand all files' : 'Collapse all files'}>
      {#if allCollapsed}<ChevronsUpDown size={15} strokeWidth={1.75} />{:else}<ChevronsDownUp size={15} strokeWidth={1.75} />{/if}
    </button>
  </div>
  {#if find.open}<FindBar />{/if}
  <div bind:this={scroller} class="flex-1 overflow-auto">
    {#each entries as f (f.path)}
      <ReviewEntry
        file={f}
        collapsed={isCollapsed(f.path)}
        current={selection.file === f.path}
        result={results.get(f.path) ?? null}
        error={errors.get(f.path) ?? null}
        ontoggle={() => toggle(f.path)}
        onnear={() => want(f.path)}
        onmarked={() => fold(f.path)}
        scrollRoot={scroller}
      />
    {/each}
  </div>
</div>
