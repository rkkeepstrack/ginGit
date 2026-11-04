<script lang="ts">
  import type { Ref } from '../../lib/types'
  import RefPill from './RefPill.svelte'

  const MAX = 3
  let { refs: all }: { refs: Ref[] } = $props()
  // Local branches and tags only; remote-tracking refs add nothing to the picture.
  const refs = $derived(all.filter((r) => r.kind !== 'remote'))
  const shown = $derived(refs.slice(0, MAX))
  const rest = $derived(refs.length - shown.length)
</script>

{#if refs.length > 0}
  <span class="inline-flex items-center gap-1 mr-2 align-middle">
    {#each shown as r (r.full)}<RefPill {r} />{/each}
    {#if rest > 0}<span class="ref-pill remote" title={refs.slice(MAX).map((r) => r.name).join('\n')}>+{rest}</span>{/if}
  </span>
{/if}
