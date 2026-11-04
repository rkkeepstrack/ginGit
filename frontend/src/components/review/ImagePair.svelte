<script lang="ts">
  import { formatBytes } from '../../lib/format'
  import { blobUrl } from '../../lib/image'
  import type { Pair, Side } from '../../lib/types'

  let { pair, path }: { pair: Pair; path: string } = $props()

  // Before in red, after in green, like the text diffs, and always next to each
  // other, unified or not: images are compared by looking from one to the other.
  // An added or deleted image has one side.
  const sides = $derived(
    [
      { kind: 'old', label: 'Before', side: pair.old },
      { kind: 'new', label: 'After', side: pair.new },
    ].filter((s) => !s.side.missing) as { kind: 'old' | 'new'; label: string; side: Side }[],
  )
  let size = $state<Record<string, string>>({})
  let failed = $state<Record<string, boolean>>({})
</script>

<div class="image-pair" class:both={sides.length === 2}>
  {#each sides as s (s.kind)}
    <figure class="image-side {s.kind}">
      <div class="image-frame">
        {#if failed[s.kind]}
          <span class="text-xs opacity-50">{s.side.size > 20 * 1024 * 1024 ? 'Larger than 20 MB, not shown.' : 'This image could not be shown.'}</span>
        {:else}
          <img
            src={blobUrl(s.side.blob, path)}
            alt="{s.label}: {path}"
            onload={(e) => { const img = e.currentTarget as HTMLImageElement; size[s.kind] = `${img.naturalWidth} × ${img.naturalHeight}` }}
            onerror={() => (failed[s.kind] = true)}
          />
        {/if}
      </div>
      <figcaption>
        {#if sides.length === 2}<span class="font-medium">{s.label}</span>{' · '}{/if}{[size[s.kind], formatBytes(s.side.size)].filter(Boolean).join(' · ')}
      </figcaption>
    </figure>
  {/each}
</div>
