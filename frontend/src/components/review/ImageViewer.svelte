<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import ArrowRight from '@lucide/svelte/icons/arrow-right'
  import ChevronLeft from '@lucide/svelte/icons/chevron-left'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import X from '@lucide/svelte/icons/x'
  import { onMount, untrack } from 'svelte'
  import type { DiffResult } from '../../lib/types'
  import { ui } from '../../state/ui.svelte'
  import Notice from '../shell/Notice.svelte'
  import DiffBody from './DiffBody.svelte'
  import { setImageView } from './imageView'

  let { paths, start, results, errors, want, onclose }: {
    /** The image files of the selection, in the files panel's order. */
    paths: string[]
    start: string
    results: Map<string, DiffResult>
    errors: Map<string, string>
    /** Asks the review for a diff; it batches and caches them. */
    want: (path: string) => void
    /** Called with the image shown last. */
    onclose: (path: string) => void
  } = $props()

  setImageView({ fill: true })

  let dialog = $state<HTMLDialogElement>()
  let path = $state(untrack(() => start))
  const at = $derived(paths.indexOf(path))
  const result = $derived(results.get(path))

  // The neighbours load along, so a step shows its image at once.
  $effect(() => { for (const p of [paths[at - 1], path, paths[at + 1]]) if (p) want(p) })
  onMount(() => dialog?.showModal())

  const step = (delta: number) => { const p = paths[at + delta]; if (p) path = p }
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    step(e.key === 'ArrowLeft' ? -1 : 1)
  }
</script>

<!-- On the window: WebKit opens the dialog without moving the focus into it. -->
<svelte:window onkeydown={onKey} />

<dialog bind:this={dialog} class="modal" id="image-viewer" aria-label="Images" onclose={() => onclose(path)}>
  <div class="modal-box p-0 w-[calc(100vw-3rem)] max-w-none h-[calc(100vh-3rem)] max-h-none flex flex-col overflow-hidden">
    <div class="panel-head hairline-b">
      <span class="tabular-nums opacity-60 shrink-0">{at + 1} / {paths.length}</span>
      <span class="truncate font-medium">{path}</span>
      <div class="flex-1"></div>
      <span class="flex items-center text-[11px] opacity-60 shrink-0"><ArrowLeft size={12} strokeWidth={2} /><ArrowRight size={12} strokeWidth={2} />: step · Esc: close</span>
      <form method="dialog"><button class="btn btn-ghost btn-xs btn-square" aria-label="Close"><X size={14} strokeWidth={1.75} /></button></form>
    </div>
    <div class="flex-1 min-h-0 relative overflow-auto">
      {#if result}
        <DiffBody {result} {path} mode={ui.diffMode} />
      {:else if errors.get(path)}
        <Notice kind="error">{errors.get(path)}</Notice>
      {:else}
        <div class="h-full flex items-center justify-center text-xs opacity-50">Loading…</div>
      {/if}
      <button class="btn btn-circle btn-sm absolute left-3 top-1/2 -translate-y-1/2" disabled={at <= 0} onclick={() => step(-1)} aria-label="Previous image"><ChevronLeft size={16} strokeWidth={1.75} /></button>
      <button class="btn btn-circle btn-sm absolute right-3 top-1/2 -translate-y-1/2" disabled={at >= paths.length - 1} onclick={() => step(1)} aria-label="Next image"><ChevronRight size={16} strokeWidth={1.75} /></button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>
