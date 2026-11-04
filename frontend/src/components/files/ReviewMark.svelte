<script lang="ts">
  import Circle from '@lucide/svelte/icons/circle'
  import CircleAlert from '@lucide/svelte/icons/circle-alert'
  import CircleCheck from '@lucide/svelte/icons/circle-check'
  import type { FileChange } from '../../lib/types'
  import { hint } from '../../state/hint.svelte'

  /** Reviewed (green), stale (amber) or not yet (muted). With onmark it is a button. */
  let { review, size = 14, onmark }: { review: FileChange['review']; size?: number; onmark?: (seen: boolean) => void } = $props()
  const label = $derived(review === 'reviewed' ? 'Reviewed · click to forget' : review === 'stale' ? 'Changed since you reviewed it · click to mark as reviewed' : 'Mark as reviewed')
</script>

{#if onmark}
  <button type="button" class="review review-{review || 'none'} btn btn-ghost btn-xs btn-square" onmousedown={(e) => e.stopPropagation()} onclick={(e) => { e.stopPropagation(); onmark(review !== 'reviewed') }} use:hint={label}>
    {#if review === 'reviewed'}<CircleCheck {size} strokeWidth={2} />{:else if review === 'stale'}<CircleAlert {size} strokeWidth={2} />{:else}<Circle {size} strokeWidth={1.75} />{/if}
  </button>
{:else if review}
  <span class="review review-{review} inline-flex shrink-0">
    {#if review === 'reviewed'}<CircleCheck {size} strokeWidth={2} />{:else}<CircleAlert {size} strokeWidth={2} />{/if}
  </span>
{/if}
