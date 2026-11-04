<script lang="ts" module>
  /** True while a jump glides; editor mounting waits for it. */
  export const gliding = $state({ now: false })
</script>

<script lang="ts">
  import { untrack } from 'svelte'
  import { authorWidth, fitColumns } from '../../lib/columns'
  import { scrollTopFor, visibleRange } from '../../lib/virtual'
  import { repo } from '../../state/repo.svelte'
  import { search } from '../../state/search.svelte'
  import { moveCursor, selection } from '../../state/selection.svelte'
  import Notice from '../shell/Notice.svelte'
  import LogRow from './LogRow.svelte'
  import { GRAPH_PAD, LANE_W, MAX_LANES, ROW_H } from './LogLanes.svelte'

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
  // Same object while no breakpoint is crossed, so rows don't update on every resize frame.
  let lastColumns: ReturnType<typeof fitColumns> | null = null
  const columns = $derived.by(() => {
    const next = fitColumns(panelWidth, graphWidth, authorW)
    if (!lastColumns || next.author !== lastColumns.author || next.date !== lastColumns.date || next.hash !== lastColumns.hash) lastColumns = next
    return lastColumns
  })

  // Keep the cursor in view. A jump (clicking a pill) centres it instead, so
  // the commits around the branch are on screen too. Only the cursor and the
  // reveal counter are tracked; a search result must not scroll the list.
  let handledReveal = 0
  $effect(() => {
    const cursor = selection.cursor
    const reveal = selection.reveal
    const el = scroller
    if (cursor === null || !el) return
    untrack(() => {
      const row = search.matches ? search.matches.indexOf(cursor) : cursor
      if (row < 0) return
      const jump = reveal !== handledReveal
      handledReveal = reveal
      const top = scrollTopFor(row, ROW_H, height, scrollTop, jump ? 'center' : 'auto')
      if (!jump) { el.scrollTo({ top, behavior: 'instant' }); return }
      glideTo(el, top)
    })
  })

  // A long glide is unfollowable and WebKit flings through it anyway: hop to
  // two screens away instantly, then glide the rest so the eye can land.
  // The glide counts as over when scrolling goes quiet, not on a long timer:
  // a scroll that never has to move would otherwise hold the editors back.
  function glideTo(el: HTMLDivElement, top: number) {
    if (Math.abs(top - el.scrollTop) < 2) return
    const hop = height * 2
    if (Math.abs(top - el.scrollTop) > hop) el.scrollTo({ top: top > el.scrollTop ? top - hop : top + hop, behavior: 'instant' })
    gliding.now = true
    let quiet: ReturnType<typeof setTimeout> | undefined
    const settle = () => {
      gliding.now = false
      clearTimeout(quiet)
      clearTimeout(cap)
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('scrollend', settle)
    }
    const onScroll = () => { clearTimeout(quiet); quiet = setTimeout(settle, 120) }
    const cap = setTimeout(settle, 800)
    el.addEventListener('scroll', onScroll)
    el.addEventListener('scrollend', settle)
    el.scrollTo({ top, behavior: 'smooth' })
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const all = search.matches ? visible : repo.commits.map((_, i) => i)
    moveCursor(e.key === 'ArrowDown' ? 1 : -1, e.shiftKey, all)
  }
</script>

<div class="flex flex-col h-full min-h-0" id="log" bind:clientWidth={panelWidth}>
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
            <LogRow
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
