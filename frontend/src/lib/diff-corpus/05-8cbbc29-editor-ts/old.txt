import { EditorState, EditorSelection, type Extension } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { highlighting } from '../../lib/highlight'
import { languageFor } from '../../lib/language'
import { gliding } from '../log/LogPanel.svelte'
import { findHighlight, setFindQuery } from './findHighlight'

/** What every read-only code view in the app shares. */
export function readOnlyBase(lang: Extension | null): Extension[] {
  return [lineNumbers(), highlighting, findHighlight, EditorView.editable.of(false), EditorState.readOnly.of(true), ...(lang ? [lang] : [])]
}

interface Disposable { destroy(): void }

// Building an editor costs a few milliseconds; a screenful at once stalls the
// frame and any scroll animation with it. One per frame keeps things moving.
const queue: (() => void)[] = []
let pumping = false
function enqueue(job: () => void) {
  queue.push(job)
  if (pumping) return
  pumping = true
  const pump = () => {
    // Let a glide finish before spending frames on editors.
    if (gliding.now) { requestAnimationFrame(pump); return }
    const next = queue.shift()
    if (!next) { pumping = false; return }
    next()
    requestAnimationFrame(pump)
  }
  requestAnimationFrame(pump)
}

/**
 * Every mounted editor, so the find bar can highlight and step through
 * matches across all of them. Kept in DOM order when read.
 */
const mounted = new Map<HTMLElement, EditorView[]>()
let currentQuery = ''

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

/**
 * Mounts a CodeMirror view into host once the file's grammar has loaded and
 * returns the teardown. Views are short-lived here, so rebuilding beats
 * reconfiguring; use it inside an $effect so deps drive the rebuild.
 */
export function mountEditor(host: HTMLElement, path: string, build: (host: HTMLElement, lang: Extension | null) => Disposable & { views: EditorView[] }): () => void {
  let disposed = false
  let view: Disposable | null = null
  languageFor(path).then((lang) => {
    enqueue(() => {
      if (disposed) return
      const built = build(host, lang)
      view = built
      mounted.set(host, built.views)
      if (currentQuery) for (const v of built.views) v.dispatch({ effects: setFindQuery.of(currentQuery) })
      // Grammar loaded, view built and its first layout pass done: what the
      // snapshot tests wait for. The merge view aligns its sides a frame late.
      requestAnimationFrame(() => { if (!disposed) host.dataset.ready = '' })
    })
  })
  return () => { disposed = true; mounted.delete(host); view?.destroy() }
}
