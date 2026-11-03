<script lang="ts">
  import { authorWidth, fitColumns } from '../../lib/columns'
  import { scrollTopFor, visibleRange } from '../../lib/virtual'
  import { repo } from '../../state/repo.svelte'
  import { search } from '../../state/search.svelte'
  import { moveCursor, selection } from '../../state/selection.svelte'
  import Notice from '../shell/Notice.svelte'
  import CommitRow from './CommitRow.svelte'
  import { GRAPH_PAD, LANE_W, MAX_LANES, ROW_H } from './LaneCell.svelte'

  const EMPTY: never[] = []

  // Row i of the list shows commit visible[i].
  const visible = $derived(search.matches ?? EMPTY)
  const count = $derived(search.matches ? visible.length : repo.commits.length)
  const indexAt = (i: number) => (search.matches ? visible[i] : i)

  let scroller = $state<HTMLDivElement>()
  let scrollTop = $state(0)
  let height = $state(0)
  let panelWidth = $state(1200)
  const range = $derived(visibleRange(scrollTop, height, ROW_H, count))

  // Filtered rows aren't neighbours, so lanes would lie; a pill takes their place.
  const graphWidth = $derived(search.matches ? GRAPH_PAD : GRAPH_PAD + Math.min(repo.maxLanes, MAX_LANES) * LANE_W + 6)
  const authorW = $derived(authorWidth(repo.commits))
  const columns = $derived(fitColumns(panelWidth, graphWidth, authorW))

  // Keep the cursor in view. A jump (clicking a pill) centres it instead, so
  // the commits around the branch are on screen too.
  let handledReveal = 0
  $effect(() => {
    const cursor = selection.cursor
    const reveal = selection.reveal
    const matches = search.matches
    if (cursor === null || !scroller) return
    const row = matches ? matches.indexOf(cursor) : cursor
    if (row < 0) return
    const jump = reveal !== handledReveal
    handledReveal = reveal
    scroller.scrollTop = scrollTopFor(row, ROW_H, scroller.clientHeight, scroller.scrollTop, jump ? 'center' : 'auto')
  })

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const all = search.matches ? visible : repo.commits.map((_, i) => i)
    moveCursor(e.key === 'ArrowDown' ? 1 : -1, e.shiftKey, all)
  }
</script>

<div class="flex flex-col h-full min-h-0" id="panel-graph" bind:clientWidth={panelWidth}>
  <div class="flex items-center h-8 col-head hairline-b shrink-0 overflow-hidden" style="scrollbar-gutter: stable">
    <div style:width="{graphWidth}px" class="shrink-0"></div>
    <div class="flex-1 pl-1.5">Commit</div>
    {#if columns.author > 0}<div class="shrink-0" style:width="{columns.author}px">Author</div>{/if}
    {#if columns.date > 0}<div class="shrink-0 text-right pr-3" style:width="{columns.date}px">Date</div>{/if}
    {#if columns.hash > 0}<div class="shrink-0" style:width="{columns.hash}px">Hash</div>{/if}
  </div>
  {#if repo.error}<Notice kind="error">{repo.error}</Notice>{/if}
  <div
    bind:this={scroller}
    bind:clientHeight={height}
    onscroll={() => { scrollTop = scroller?.scrollTop ?? 0 }}
    class="flex-1 overflow-auto outline-none"
    style="scrollbar-gutter: stable"
    tabindex="0"
    onkeydown={onKeyDown}
    role="grid"
  >
    {#if count === 0 && !repo.loading && !repo.error}
      <div class="p-6 text-center opacity-50">{search.matches ? 'No commits match.' : 'No commits.'}</div>
    {/if}
    <div style:height="{count * ROW_H}px" class="relative">
      {#each { length: range.end - range.start } as _, k (indexAt(range.start + k))}
        {@const idx = indexAt(range.start + k)}
        {@const c = repo.commits[idx]}
        {#if c}
          <div class="absolute left-0 right-0" style:top="{(range.start + k) * ROW_H}px">
            <CommitRow
              index={idx}
              commit={c}
              prev={repo.commits[idx - 1]}
              refs={repo.refsByHash.get(c.hash) ?? EMPTY}
              isHead={c.hash === repo.info?.head}
              selected={selection.selected.has(c.hash)}
              {graphWidth}
              {columns}
              branch={search.matches ? search.names[c.hash] ?? '' : undefined}
            />
          </div>
        {/if}
      {/each}
    </div>
  </div>
</div>
