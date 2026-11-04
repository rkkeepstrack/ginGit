<script lang="ts">
  import FileDiffIcon from '@lucide/svelte/icons/file-diff'
  import { changes } from '../../state/changes.svelte'
  import AllFilesView from './AllFilesView.svelte'
</script>

{#if changes.changeSet && changes.changeSet.files.length > 0}
  {#key changes.changeSet.hashes.join(',')}
    <AllFilesView />
  {/key}
{:else}
  <div class="h-full flex flex-col items-center justify-center gap-2 text-[12.5px] opacity-40 select-none" id="panel-diff">
    <FileDiffIcon size={28} strokeWidth={1.25} />
    {changes.loading ? 'Loading…' : 'No file changes'}
  </div>
{/if}
