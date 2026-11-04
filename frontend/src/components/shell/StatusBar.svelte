<script lang="ts">
  import { formatCount } from '../../lib/format'
  import { modKey } from '../../lib/platform'
  import { hints } from '../../state/hint.svelte'
  import { repo } from '../../state/repo.svelte'
  import { selection } from '../../state/selection.svelte'

  const idleHint = `Click: select · ${modKey}-click: toggle · Shift-click: range`
  const selectionHint = `${modKey}F: find in changes · [ ] or ${modKey}↑↓: previous/next file · ${modKey}⇧D: diff layout · Esc: clear`
  const count = $derived(selection.selected.size)
</script>

<div class="h-6 shrink-0 flex items-center gap-3 px-3 text-[11px] hairline-t bg-base-200/40 select-none whitespace-nowrap overflow-hidden">
  <span class="truncate opacity-60">
    {#if hints.hint}{hints.hint}{:else if count > 0}{count} selected · {selectionHint}{:else}{idleHint}{/if}
  </span>
  <div class="flex-1"></div>
  {#if repo.info}
    <span class="opacity-45 tabular-nums shrink-0">
      {#if repo.loading}<span class="loading loading-spinner loading-xs mr-1 align-middle"></span>{/if}
      {formatCount(repo.commits.length)} commits
    </span>
  {/if}
</div>
