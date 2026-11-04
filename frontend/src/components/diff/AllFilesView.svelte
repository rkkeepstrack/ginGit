<script lang="ts">
  import ChevronsDownUp from '@lucide/svelte/icons/chevrons-down-up'
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down'
  import { ApiError, api } from '../../lib/api'
  import type { DiffResult, FileChange } from '../../lib/types'
  import { changes } from '../../state/changes.svelte'
  import { hint } from '../../state/hint.svelte'
  import { repo } from '../../state/repo.svelte'
  import { selection } from '../../state/selection.svelte'
  import FileSection from './FileSection.svelte'
  import FindBar from './FindBar.svelte'
  import { find } from '../../state/find.svelte'

  // Every changed file, one collapsible section each, in the files panel's order.
  const files = $derived.by(() => {
    const byPath = new Map(changes.changeSet?.files.map((f) => [f.path, f]))
    return changes.paths.map((p) => byPath.get(p)).filter((f): f is FileChange => !!f)
  })
  let collapsed = $state.raw<Set<string>>(new Set())
  let scroller = $state<HTMLDivElement>()
  const allCollapsed = $derived(collapsed.size >= files.length && files.length > 0)
  const reviewed = $derived(files.filter((f) => f.review === 'reviewed').length)
  // Reviewed files start folded; a mark folds its section.
  let seeded = false
  $effect(() => {
    if (seeded || files.length === 0) return
    seeded = true
    collapsed = new Set(files.filter((f) => f.review === 'reviewed').map((f) => f.path))
  })
  const fold = (path: string) => { collapsed = new Set([...collapsed, path]) }
  // While a find is active, only files with a hit stay open, and they load.
  const isCollapsed = (path: string) => (find.counts ? !(path in find.counts) : collapsed.has(path))
  $effect(() => { if (find.counts) for (const path of Object.keys(find.counts)) want(path) })

  // Diffs are fetched for all sections that come into reach within the same
  // frame, in one bridge call and one git round, instead of one per section.
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
      const message = (e as ApiError).display ?? String(e)
      errors = new Map([...errors, ...paths.map((p) => [p, message] as const)])
    }
  }

  const toggle = (path: string) => {
    const n = new Set(collapsed)
    n.has(path) ? n.delete(path) : n.add(path)
    collapsed = n
  }
</script>

<div class="flex flex-col h-full min-h-0" id="panel-diff">
  <div class="panel-head hairline-b">
    <span class="font-medium tabular-nums">{files.length} {files.length === 1 ? 'file' : 'files'}</span>
    {#if reviewed > 0}<span class="opacity-60 tabular-nums">{reviewed} of {files.length} reviewed</span>{/if}
    <div class="flex-1"></div>
    <button class="btn btn-ghost btn-xs btn-square" onclick={() => (collapsed = allCollapsed ? new Set() : new Set(files.map((f) => f.path)))} use:hint={allCollapsed ? 'Expand all files' : 'Collapse all files'}>
      {#if allCollapsed}<ChevronsUpDown size={15} strokeWidth={1.75} />{:else}<ChevronsDownUp size={15} strokeWidth={1.75} />{/if}
    </button>
  </div>
  {#if find.open}<FindBar />{/if}
  <div bind:this={scroller} class="flex-1 overflow-auto">
    {#each files as f (f.path)}
      <FileSection
        file={f}
        collapsed={isCollapsed(f.path)}
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
