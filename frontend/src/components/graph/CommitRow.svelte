<script lang="ts">
  import { conventionalPrefix } from '../../lib/color'
  import { copyText } from '../../lib/clipboard'
  import type { Columns } from '../../lib/columns'
  import { absoluteDate, relativeDate, shortHash } from '../../lib/format'
  import { hasMod } from '../../lib/platform'
  import type { Commit, Ref } from '../../lib/types'
  import { flashMessage, hint } from '../../state/hint.svelte'
  import { repo } from '../../state/repo.svelte'
  import { click } from '../../state/selection.svelte'
  import LaneCell, { ROW_H } from './LaneCell.svelte'
  import RefPill from './RefPill.svelte'
  import RefPills from './RefPills.svelte'

  let { index, commit, prev, refs, isHead, selected, graphWidth, columns, branch }: {
    index: number
    commit: Commit
    prev: Commit | undefined
    refs: Ref[]
    isHead: boolean
    selected: boolean
    graphWidth: number
    columns: Columns
    /** Set while a search filters the list: replaces the lanes with a pill. */
    branch?: string
  } = $props()

  const isMerge = $derived(commit.parents.length > 1)
  const conv = $derived(conventionalPrefix(commit.subject))
  /** The ref behind a search hit's branch name, or a stand-in if the list has moved on. */
  const branchRef = $derived(branch && !refs.some((r) => r.name === branch)
    ? repo.refs.find((r) => r.kind === 'head' && r.name === branch) ?? { name: branch, full: `refs/heads/${branch}`, hash: '', kind: 'head' as const, isHead: false }
    : null)

  async function copyHash() {
    const ok = await copyText(commit.hash)
    flashMessage(ok ? `Copied ${commit.hash.slice(0, 7)} to the clipboard` : 'Clipboard not available')
  }
</script>

<div
  class="commit-row flex items-center"
  class:selected
  style:height="{ROW_H}px"
  style:line-height="{ROW_H}px"
  onmousedown={(e) => { if (e.button === 0) click(index, { toggle: hasMod(e), range: e.shiftKey }) }}
  data-hash={commit.hash}
  role="row"
  tabindex="-1"
>
  {#if branch === undefined}
    <LaneCell row={commit.row} prev={prev?.row} {isMerge} {isHead} width={graphWidth} />
  {:else}
    <div class="shrink-0" style:width="{graphWidth}px"></div>
  {/if}
  <div class="flex-1 min-w-0 pl-1.5 pr-3 overflow-hidden text-ellipsis" class:opacity-70={isMerge} title={commit.subject}>
    {#if branchRef}<span class="mr-2"><RefPill r={branchRef} /></span>{/if}
    <RefPills {refs} />
    {#if conv}<span class="kind kind-{conv.kind}">{conv.prefix}</span> {conv.rest}{:else}{commit.subject}{/if}
  </div>
  {#if columns.author > 0}
    <div class="shrink-0 overflow-hidden text-ellipsis pr-3 opacity-70" style:width="{columns.author}px" title="{commit.author} <{commit.authorEmail}>">{commit.author}</div>
  {/if}
  {#if columns.date > 0}
    <div class="shrink-0 pr-3 opacity-55 text-right tabular-nums" style:width="{columns.date}px" title={absoluteDate(commit.authorDate)}>{relativeDate(commit.authorDate)}</div>
  {/if}
  {#if columns.hash > 0}
    <div class="shrink-0 pr-2" style:width="{columns.hash}px">
      <button type="button" class="hash-cell mono opacity-50" onmousedown={(e) => e.stopPropagation()} onclick={(e) => { e.stopPropagation(); void copyHash() }} use:hint={`Click to copy ${commit.hash}`}>
        {shortHash(commit.hash)}
      </button>
    </div>
  {/if}
</div>
