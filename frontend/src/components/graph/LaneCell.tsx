import { memo } from 'react'
import type { Row } from '../../lib/types'

export const LANE_W = 14
export const ROW_H = 28
export const MAX_LANES = 12
/** Breathing room before the first lane so nodes don't kiss the window edge. */
export const GRAPH_PAD = 12

const cx = (lane: number) => GRAPH_PAD + lane * LANE_W + LANE_W / 2
const MID = ROW_H / 2

/**
 * One row's slice of the graph. The row draws the bottom half of its own
 * outgoing edges and the top half of the previous row's, split exactly at the
 * row boundary so curves join seamlessly without overflow tricks.
 */
export const LaneCell = memo(function LaneCell({ row, prev, isMerge, isHead, width }: {
  row: Row
  prev: Row | undefined
  isMerge: boolean
  isHead: boolean
  width: number
}) {
  const paths: { d: string; color: number; faded: boolean }[] = []
  if (prev) {
    for (const s of prev.segments) {
      const x1 = cx(s.from), x2 = cx(s.to)
      const d = x1 === x2
        ? `M${x2},0 V${MID}`
        : `M${(x1 + x2) / 2},0 C${(x1 + 3 * x2) / 4},${MID / 4} ${x2},${MID / 2} ${x2},${MID}`
      paths.push({ d, color: s.color, faded: s.to >= MAX_LANES })
    }
  }
  for (const s of row.segments) {
    const x1 = cx(s.from), x2 = cx(s.to)
    const d = x1 === x2
      ? `M${x1},${MID} V${ROW_H}`
      : `M${x1},${MID} C${x1},${MID + MID / 2} ${(3 * x1 + x2) / 4},${MID + (3 * MID) / 4} ${(x1 + x2) / 2},${ROW_H}`
    paths.push({ d, color: s.color, faded: s.from >= MAX_LANES })
  }
  const nx = cx(row.lane)
  const stroke = `var(--lane-${row.color})`
  return (
    <svg width={width} height={ROW_H} className="shrink-0 block" style={{ overflow: 'hidden' }}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill="none" stroke={`var(--lane-${p.color})`} strokeWidth={2} strokeLinecap="round" opacity={p.faded ? 0.25 : 1} />
      ))}
      {isHead && <circle cx={nx} cy={MID} r={7} fill="none" stroke={stroke} strokeWidth={1.5} opacity={0.6} />}
      {isMerge
        ? <circle cx={nx} cy={MID} r={3.5} fill="var(--color-base-100)" stroke={stroke} strokeWidth={2} />
        : <circle cx={nx} cy={MID} r={4} fill={stroke} />}
    </svg>
  )
})
