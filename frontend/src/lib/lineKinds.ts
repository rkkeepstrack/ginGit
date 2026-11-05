import { RangeSet, RangeSetBuilder, StateEffect, StateField, type EditorState } from '@codemirror/state'
import { Decoration, EditorView, GutterMarker, gutterLineClass, type DecorationSet } from '@codemirror/view'
import type { LineKind } from './lineDiff'

/**
 * Tags every changed line with its kind from the line diff (cm-kind-inserted,
 * -modified, -deleted), so the editor diff style can colour new, rewritten and
 * removed lines apart. CodeMirror's own chunks can't: they merge a new block
 * and a re-indented neighbour into one. The patch style ignores the tags.
 */
type Shown = Exclude<LineKind, 'same'>

// A re-indented line is a modified one that skips the word highlight.
const classes: Record<Shown, string> = {
  inserted: 'cm-kind-inserted',
  modified: 'cm-kind-modified',
  reindented: 'cm-kind-modified cm-kind-reindented',
  deleted: 'cm-kind-deleted',
}
class KindMarker extends GutterMarker {
  constructor(kind: Shown) {
    super()
    this.elementClass = classes[kind]
  }
}
const shown = Object.keys(classes) as Shown[]
const lineDeco = Object.fromEntries(shown.map((k) => [k, Decoration.line({ class: classes[k] })])) as Record<Shown, Decoration>
const gutterMark = Object.fromEntries(shown.map((k) => [k, new KindMarker(k)])) as Record<Shown, GutterMarker>

// Leading and trailing whitespace of a changed line: never a word, so no highlight shows there.
const whitespace = Decoration.mark({ class: 'cm-ws' })

interface Marks { lines: DecorationSet; spaces: DecorationSet; gutter: RangeSet<GutterMarker> }
const setKinds = StateEffect.define<LineKind[]>()

function build(state: EditorState, kinds: LineKind[]): Marks {
  const lines = new RangeSetBuilder<Decoration>()
  const spaces = new RangeSetBuilder<Decoration>()
  const gutter = new RangeSetBuilder<GutterMarker>()
  for (let n = 1; n <= state.doc.lines && n <= kinds.length; n++) {
    const kind = kinds[n - 1]
    if (kind === 'same') continue
    const line = state.doc.line(n)
    lines.add(line.from, line.from, lineDeco[kind])
    gutter.add(line.from, line.from, gutterMark[kind])
    const lead = line.text.length - line.text.trimStart().length
    const tail = line.text.trimEnd().length
    if (lead > 0) spaces.add(line.from, line.from + lead, whitespace)
    if (tail > lead && tail < line.text.length) spaces.add(line.from + tail, line.to, whitespace)
  }
  return { lines: lines.finish(), spaces: spaces.finish(), gutter: gutter.finish() }
}

export const lineKinds = StateField.define<Marks>({
  create: () => ({ lines: Decoration.none, spaces: Decoration.none, gutter: RangeSet.empty }),
  update(marks, tr) {
    for (const e of tr.effects) if (e.is(setKinds)) return build(tr.state, e.value)
    return marks
  },
  provide: (f) => [EditorView.decorations.from(f, (m) => m.lines), EditorView.decorations.from(f, (m) => m.spaces), gutterLineClass.from(f, (m) => m.gutter)],
})

export function markLines(view: EditorView, kinds: LineKind[]) {
  view.dispatch({ effects: setKinds.of(kinds) })
}
