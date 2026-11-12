<script lang="ts">
  import { formatBytes } from '../../lib/format'
  import { blobUrl } from '../../lib/image'
  import type { Pair, Side } from '../../lib/types'
  import { hint } from '../../state/hint.svelte'
  import { getImageView, hasImageView } from './imageView'

  let { pair, path }: { pair: Pair; path: string } = $props()
  const view = hasImageView() ? getImageView() : {}

  // Before in red, after in green, like the text diffs, and always next to each
  // other, unified or not: images are compared by looking from one to the other.
  // An added or deleted image has one side.
  const sides = $derived(
    [
      { kind: 'old', label: 'Before', side: pair.old },
      { kind: 'new', label: 'After', side: pair.new },
    ].filter((s) => !s.side.missing) as { kind: 'old' | 'new'; label: string; side: Side }[],
  )
  let natural = $state<Record<string, { w: number; h: number }>>({})
  let failed = $state<Record<string, boolean>>({})

  // Filling the viewer, both sides share one scale so a size change stays visible.
  // Enlarged by whole factors, pixel-sharp: a blurred icon hides what changed.
  let frameW = $state(0)
  let frameH = $state(0)
  const PAD = 32
  const scale = $derived.by(() => {
    const sizes = Object.values(natural)
    if (!view.fill || sizes.length === 0 || frameW <= PAD || frameH <= PAD) return null
    const fit = Math.min(...sizes.map((s) => Math.min((frameW - PAD) / s.w, (frameH - PAD) / s.h)))
    return fit >= 2 ? Math.floor(fit) : fit
  })
</script>

{#snippet image(s: (typeof sides)[number])}
  <img
    src={blobUrl(s.side.blob, path)}
    alt="{s.label}: {path}"
    class:pixelated={scale !== null && scale >= 2}
    style:width={scale && natural[s.kind] ? `${natural[s.kind].w * scale}px` : null}
    style:height={scale && natural[s.kind] ? `${natural[s.kind].h * scale}px` : null}
    onload={(e) => { const img = e.currentTarget as HTMLImageElement; natural[s.kind] = { w: img.naturalWidth, h: img.naturalHeight } }}
    onerror={() => (failed[s.kind] = true)}
  />
{/snippet}

<div class="image-pair" class:both={sides.length === 2} class:fill={view.fill}>
  {#each sides as s (s.kind)}
    <figure class="image-side {s.kind}">
      <div class="image-frame" bind:clientWidth={frameW} bind:clientHeight={frameH}>
        {#if failed[s.kind]}
          <span class="text-xs opacity-50">{s.side.size > 20 * 1024 * 1024 ? 'Larger than 20 MB, not shown.' : 'This image could not be shown.'}</span>
        {:else if view.enlarge}
          <button class="image-open" onclick={() => view.enlarge?.(path)} use:hint={'Enlarge, then ← → through every image of the selection'}>{@render image(s)}</button>
        {:else}
          {@render image(s)}
        {/if}
      </div>
      <figcaption>
        {#if sides.length === 2}<span class="font-medium">{s.label}</span>{' · '}{/if}{[natural[s.kind] && `${natural[s.kind].w} × ${natural[s.kind].h}`, formatBytes(s.side.size)].filter(Boolean).join(' · ')}
      </figcaption>
    </figure>
  {/each}
</div>
