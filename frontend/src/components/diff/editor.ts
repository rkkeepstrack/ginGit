import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { highlighting } from '../../lib/highlight'
import { languageFor } from '../../lib/language'
import { gliding } from '../graph/CommitList.svelte'

/** What every read-only code view in the app shares. */
export function readOnlyBase(lang: Extension | null): Extension[] {
  return [lineNumbers(), highlighting, EditorView.editable.of(false), EditorState.readOnly.of(true), ...(lang ? [lang] : [])]
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
 * Mounts a CodeMirror view into host once the file's grammar has loaded and
 * returns the teardown. Views are short-lived here, so rebuilding beats
 * reconfiguring; use it inside an $effect so deps drive the rebuild.
 */
export function mountEditor(host: HTMLElement, path: string, build: (host: HTMLElement, lang: Extension | null) => Disposable): () => void {
  let disposed = false
  let view: Disposable | null = null
  languageFor(path).then((lang) => {
    enqueue(() => {
      if (disposed) return
      view = build(host, lang)
      // Grammar loaded, view built and its first layout pass done: what the
      // snapshot tests wait for. The merge view aligns its sides a frame late.
      requestAnimationFrame(() => { if (!disposed) host.dataset.ready = '' })
    })
  })
  return () => { disposed = true; view?.destroy() }
}
