<script lang="ts" module>
  export const LANE_W = 14
  export const ROW_H = 28
  export const MAX_LANES = 12
  /** Breathing room before the first lane so nodes don't kiss the window edge. */
  export const GRAPH_PAD = 12
  const cx = (lane: number) => GRAPH_PAD + lane * LANE_W + LANE_W / 2
  const MID = ROW_H / 2
</script>

<script lang="ts">
  import type { Row } from '../../lib/types'

  let { row, prev, isMerge, isHead, width }: { row: Row; prev: Row | undefined; isMerge: boolean; isHead: boolean; width: number } = $props()

  // The row draws the bottom half of its own outgoing edges and the top half
  // of the previous row's, split exactly at the row boundary so curves join
  // seamlessly without overflow tricks.
  const paths = $derived.by(() => {
    const out: { d: string; color: number; faded: boolean }[] = []
    if (prev) {
      for (const s of prev.segments) {
        const x1 = cx(s.from), x2 = cx(s.to)
        const d = x1 === x2
          ? `M${x2},0 V${MID}`
          : `M${(x1 + x2) / 2},0 C${(x1 + 3 * x2) / 4},${MID / 4} ${x2},${MID / 2} ${x2},${MID}`
        out.push({ d, color: s.color, faded: s.to >= MAX_LANES })
      }
    }
    for (const s of row.segments) {
      const x1 = cx(s.from), x2 = cx(s.to)
      const d = x1 === x2
        ? `M${x1},${MID} V${ROW_H}`
        : `M${x1},${MID} C${x1},${MID + MID / 2} ${(3 * x1 + x2) / 4},${MID + (3 * MID) / 4} ${(x1 + x2) / 2},${ROW_H}`
      out.push({ d, color: s.color, faded: s.from >= MAX_LANES })
    }
    return out
  })
  const nx = $derived(cx(row.lane))
  const stroke = $derived(`var(--lane-${row.color})`)
</script>

<svg {width} height={ROW_H} class="shrink-0 block" style="overflow: hidden">
  {#each paths as p}
    <path d={p.d} fill="none" stroke="var(--lane-{p.color})" stroke-width="2" stroke-linecap="round" opacity={p.faded ? 0.25 : 1} />
  {/each}
  {#if isHead}<circle cx={nx} cy={MID} r="7" fill="none" {stroke} stroke-width="1.5" opacity="0.6" />{/if}
  {#if isMerge}
    <circle cx={nx} cy={MID} r="3.5" fill="var(--color-base-100)" {stroke} stroke-width="2" />
  {:else}
    <circle cx={nx} cy={MID} r="4" fill={stroke} />
  {/if}
</svg>
