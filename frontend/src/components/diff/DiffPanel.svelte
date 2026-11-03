<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronUp from '@lucide/svelte/icons/chevron-up'
  import FileDiffIcon from '@lucide/svelte/icons/file-diff'
  import LayoutList from '@lucide/svelte/icons/layout-list'
  import { changeMark } from '../../lib/changeType'
  import { categoryFor, iconFor } from '../../lib/fileIcon'
  import { shortHash } from '../../lib/format'
  import { changes, stepFile } from '../../state/changes.svelte'
  import { hint } from '../../state/hint.svelte'
  import { repo } from '../../state/repo.svelte'
  import { selection, setFile } from '../../state/selection.svelte'
  import { ui } from '../../state/ui.svelte'
  import Notice from '../shell/Notice.svelte'
  import AllFilesView from './AllFilesView.svelte'
  import DiffBody from './DiffBody.svelte'
  import { FileDiff } from './fileDiff.svelte'

  const diff = new FileDiff()
  const file = $derived(selection.file)
  $effect(() => { if (file) diff.watch(repo.info?.path, selection.hashes, file) })

  const idx = $derived(file ? changes.paths.indexOf(file) : -1)
  const segments = $derived(file ? file.split('/') : [])
  const FileIcon = $derived(iconFor(file ?? ''))
  const mark = $derived(diff.result ? changeMark[diff.result.type] : undefined)
  const first = $derived(diff.result && !diff.result.stacked ? diff.result.pairs[0] : null)
</script>

{#if file}
  <div class="flex flex-col h-full min-h-0" id="panel-diff">
    <div class="panel-head hairline-b">
      <FileIcon size={14} strokeWidth={1.75} class="shrink-0 opacity-80 ft-{categoryFor(file)}" />
      <span class="truncate select-text" title={file}>
        {#each segments as s, i}<span class={i === segments.length - 1 ? '' : 'opacity-50'}>{s}{i < segments.length - 1 ? '/' : ''}</span>{/each}
      </span>
      {#if mark && diff.result}<span class="ct-{diff.result.type} text-[11px] font-medium shrink-0">{mark.label}</span>{/if}
      {#if first}
        <span class="opacity-50 shrink-0" title="Old commit → new commit">
          {first.old.missing ? '∅' : first.old.path !== first.new.path ? first.old.path : 'parent'} → {shortHash(first.commit)}
        </span>
      {/if}
      <div class="flex-1"></div>
      <span class="opacity-50 tabular-nums shrink-0">{idx >= 0 ? `${idx + 1} / ${changes.paths.length}` : ''}</span>
      <button class="btn btn-ghost btn-xs btn-square" onclick={() => stepFile(-1)} disabled={idx <= 0} use:hint={'Previous file  ['}><ChevronUp size={15} strokeWidth={1.75} /></button>
      <button class="btn btn-ghost btn-xs btn-square" onclick={() => stepFile(1)} disabled={idx < 0 || idx >= changes.paths.length - 1} use:hint={'Next file  ]'}><ChevronDown size={15} strokeWidth={1.75} /></button>
      <button class="btn btn-ghost btn-xs btn-square" onclick={() => setFile(null)} use:hint={'Back to all files'}><LayoutList size={15} strokeWidth={1.75} /></button>
    </div>
    {#if diff.error}<Notice kind="error">{diff.error}</Notice>{/if}
    {#if diff.loading && !diff.result}<div class="p-4 text-xs opacity-50">Loading…</div>{/if}
    {#if diff.result}<DiffBody result={diff.result} path={file} mode={ui.diffMode} stacked={false} />{/if}
  </div>
{:else if changes.changeSet && changes.changeSet.files.length > 0}
  {#key changes.changeSet.hashes.join(',')}
    <AllFilesView />
  {/key}
{:else}
  <div class="h-full flex flex-col items-center justify-center gap-2 text-[12.5px] opacity-40 select-none" id="panel-diff">
    <FileDiffIcon size={28} strokeWidth={1.25} />
    {changes.loading ? 'Loading…' : 'No file changes'}
  </div>
{/if}
