<script lang="ts">
  import { isImage } from '../../lib/image'
  import type { Pair } from '../../lib/types'
  import type { DiffMode } from '../../state/ui.svelte'
  import ImagePair from './ImagePair.svelte'
  import MergeViewHost from './MergeViewHost.svelte'
  import SingleSideView from './SingleSideView.svelte'

  let { pair, path, mode }: { pair: Pair; path: string; mode: DiffMode } = $props()
  const problem = $derived(pair.old.binary || pair.new.binary ? 'Binary file, no text diff.'
    : pair.old.tooLarge || pair.new.tooLarge ? 'File is larger than 2 MB, diff skipped.'
    : null)
  const oneSided = $derived(pair.old.missing !== pair.new.missing)
</script>

{#if isImage(path)}
  <ImagePair {pair} {path} />
{:else if problem}
  <div class="p-3 text-xs opacity-50">{problem}</div>
{:else if oneSided}
  <SingleSideView text={pair.old.missing ? pair.new.content : pair.old.content} {path} kind={pair.old.missing ? 'added' : 'deleted'} />
{:else}
  <MergeViewHost oldText={pair.old.content} newText={pair.new.content} {path} {mode} />
{/if}
