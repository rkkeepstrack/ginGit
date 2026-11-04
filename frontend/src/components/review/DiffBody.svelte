<script lang="ts">
  import GitCommitHorizontal from '@lucide/svelte/icons/git-commit-horizontal'
  import { changeMark } from '../../lib/changeType'
  import { shortHash } from '../../lib/format'
  import type { DiffResult } from '../../lib/types'
  import { commitOf } from '../../state/repo.svelte'
  import type { DiffMode } from '../../state/ui.svelte'
  import Notice from '../shell/Notice.svelte'
  import PairView from './PairView.svelte'

  let { result, path, mode }: { result: DiffResult; path: string; mode: DiffMode } = $props()
</script>

<!-- Renders a diff result: one pair, or several stacked with a note. -->
{#if !result.stacked}
  <PairView pair={result.pairs[0]} {path} {mode} />
{:else}
  <Notice kind="warning">{result.note}</Notice>
  {#each result.pairs as p (p.commit)}
    {@const mark = changeMark[p.type]}
    <div class="flex items-center gap-2 px-3 h-8 text-[12px] bg-base-200/60">
      <GitCommitHorizontal size={14} strokeWidth={1.75} class="opacity-50" />
      <span class="mono opacity-60">{shortHash(p.commit)}</span>
      <span class="truncate">{commitOf(p.commit)?.subject}</span>
      {#if mark}<span class="ct-label ct-{p.type}">{mark.label}</span>{/if}
    </div>
    <PairView pair={p} {path} {mode} />
  {/each}
{/if}
