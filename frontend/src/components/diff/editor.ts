import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { highlighting } from '../../lib/highlight'
import { languageFor } from '../../lib/language'

/** What every read-only code view in the app shares. */
export function readOnlyBase(lang: Extension | null): Extension[] {
  return [lineNumbers(), highlighting, EditorView.editable.of(false), EditorState.readOnly.of(true), ...(lang ? [lang] : [])]
}

interface Disposable { destroy(): void }

/**
 * Mounts a CodeMirror view into host once the file's grammar has loaded and
 * returns the teardown. Views are short-lived here, so rebuilding beats
 * reconfiguring; use it inside an $effect so deps drive the rebuild.
 */
export function mountEditor(host: HTMLElement, path: string, build: (host: HTMLElement, lang: Extension | null) => Disposable): () => void {
  let disposed = false
  let view: Disposable | null = null
  languageFor(path).then((lang) => { if (!disposed) view = build(host, lang) })
  return () => { disposed = true; view?.destroy() }
}
