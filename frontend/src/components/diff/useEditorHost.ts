import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { useEffect, useRef, type DependencyList } from 'react'
import { highlighting } from '../../lib/highlight'
import { languageFor } from '../../lib/language'

/** What every read-only code view in the app shares. */
export function readOnlyBase(lang: Extension | null): Extension[] {
  return [lineNumbers(), highlighting, EditorView.editable.of(false), EditorState.readOnly.of(true), ...(lang ? [lang] : [])]
}

interface Disposable { destroy(): void }

/**
 * Mounts a CodeMirror view into the returned ref once the file's grammar has
 * loaded, and tears it down when deps change. Views are short-lived here, so
 * rebuilding beats reconfiguring.
 */
export function useEditorHost(path: string, build: (host: HTMLElement, lang: Extension | null) => Disposable, deps: DependencyList) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = ref.current
    if (!host) return
    let disposed = false
    let view: Disposable | null = null
    languageFor(path).then((lang) => {
      if (!disposed) view = build(host, lang)
    })
    return () => { disposed = true; view?.destroy() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}
