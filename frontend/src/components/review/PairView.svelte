<script lang="ts">
  import type { Pair } from '../../lib/types'
  import type { DiffMode } from '../../state/ui.svelte'
  import MergeViewHost from './MergeViewHost.svelte'
  import SingleSideView from './SingleSideView.svelte'

  let { pair, path, mode, stacked }: { pair: Pair; path: string; mode: DiffMode; stacked: boolean } = $props()
  const problem = $derived(pair.old.binary || pair.new.binary ? 'Binary file, no text diff.'
    : pair.old.tooLarge || pair.new.tooLarge ? 'File is larger than 2 MB, diff skipped.'
    : null)
  const oneSided = $derived(pair.old.missing !== pair.new.missing)
</script>

{#if problem}
  <div class="{stacked ? 'p-3' : 'flex-1 flex items-center justify-center'} text-xs opacity-50">{problem}</div>
{:else}
  <div class={stacked ? '' : 'flex-1 min-h-0'}>
    {#if oneSided}
      <SingleSideView text={pair.old.missing ? pair.new.content : pair.old.content} {path} kind={pair.old.missing ? 'added' : 'deleted'} {stacked} />
    {:else}
      <MergeViewHost oldText={pair.old.content} newText={pair.new.content} {path} {mode} {stacked} />
    {/if}
  </div>
{/if}
