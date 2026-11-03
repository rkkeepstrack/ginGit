<script lang="ts">
  import type { Snippet } from 'svelte'
  let { kind = 'info', children }: { kind?: 'info' | 'error' | 'warning'; children: Snippet } = $props()
  const cls = $derived(kind === 'error' ? 'alert-error' : kind === 'warning' ? 'alert-warning' : 'alert-info')
</script>

<div class="alert {cls} alert-soft rounded-none py-1.5 px-3 text-xs shrink-0">
  <span class="min-w-0 break-words select-text">{@render children()}</span>
</div>
