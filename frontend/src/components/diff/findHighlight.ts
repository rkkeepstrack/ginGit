import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, MatchDecorator, ViewPlugin, type ViewUpdate } from '@codemirror/view'

/** Sets the text to highlight in one editor; empty clears it. */
export const setFindQuery = StateEffect.define<string>()

const findQuery = StateField.define<string>({
  create: () => '',
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setFindQuery)) return e.value
    return value
  },
})

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const decorator = (q: string) => (q ? new MatchDecorator({ regexp: new RegExp(escape(q), 'gi'), decoration: Decoration.mark({ class: 'cm-findMatch' }) }) : null)

// Marks every occurrence of the query in the viewport. The search package's
// own highlighter only works while its panel is open, hence this one.
const highlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    private matcher: MatchDecorator | null
    constructor(view: EditorView) {
      this.matcher = decorator(view.state.field(findQuery))
      this.decorations = this.matcher ? this.matcher.createDeco(view) : Decoration.none
    }
    update(u: ViewUpdate) {
      const q = u.state.field(findQuery)
      if (q !== u.startState.field(findQuery)) {
        this.matcher = decorator(q)
        this.decorations = this.matcher ? this.matcher.createDeco(u.view) : Decoration.none
      } else if (this.matcher && (u.docChanged || u.viewportChanged)) {
        this.decorations = this.matcher.updateDeco(u, this.decorations)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

export const findHighlight: Extension = [findQuery, highlighter]
