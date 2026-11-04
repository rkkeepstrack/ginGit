import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { setFindQuery } from '../lib/findHighlight'

/**
 * Every mounted CodeMirror view, so the find bar can highlight and step
 * through matches across all of them. Not reactive: the views are the state.
 */
const mounted = new Map<HTMLElement, EditorView[]>()
let currentQuery = ''

export function registerEditors(host: HTMLElement, views: EditorView[]) {
  mounted.set(host, views)
  if (currentQuery) for (const v of views) v.dispatch({ effects: setFindQuery.of(currentQuery) })
}

export function unregisterEditors(host: HTMLElement) {
  mounted.delete(host)
}

function inDomOrder(): [HTMLElement, EditorView[]][] {
  return [...mounted.entries()].sort(([a], [b]) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
}

/** Highlights text in every mounted editor; an empty query clears it. */
export function highlightMatches(query: string) {
  currentQuery = query
  for (const views of mounted.values()) for (const v of views) v.dispatch({ effects: setFindQuery.of(query) })
}

export interface Match { host: HTMLElement; view: EditorView; from: number; to: number }

/** Every occurrence of the current query across mounted editors, in document order. */
export function collectMatches(): Match[] {
  const out: Match[] = []
  const needle = currentQuery.toLowerCase()
  if (!needle) return out
  for (const [host, views] of inDomOrder()) {
    for (const view of views) {
      const text = view.state.doc.toString().toLowerCase()
      let i = text.indexOf(needle)
      while (i >= 0) {
        out.push({ host, view, from: i, to: i + needle.length })
        i = text.indexOf(needle, i + needle.length)
      }
    }
  }
  return out
}

/** Selects a match and brings it on screen. */
export function revealMatch(m: Match) {
  m.view.dispatch({ selection: EditorSelection.single(m.from, m.to), effects: EditorView.scrollIntoView(m.from, { y: 'center' }) })
  m.view.contentDOM.focus({ preventScroll: true })
}
