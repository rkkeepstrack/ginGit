import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { highlighting } from '../../lib/highlight'
import { languageFor } from '../../lib/language'

/**
 * A file that only exists on one side (added or deleted) has nothing to
 * compare against, so it gets the full width as plain tinted code.
 */
export function SingleSideView({ text, path, kind, stacked = false }: {
  text: string
  path: string
  kind: 'added' | 'deleted'
  stacked?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = ref.current
    if (!host) return
    let disposed = false
    let view: EditorView | null = null
    languageFor(path).then((lang: Extension | null) => {
      if (disposed) return
      view = new EditorView({
        doc: text,
        extensions: [lineNumbers(), highlighting, EditorView.editable.of(false), EditorState.readOnly.of(true), ...(lang ? [lang] : [])],
        parent: host,
      })
    })
    return () => { disposed = true; view?.destroy(); host.replaceChildren() }
  }, [text, path])
  return <div ref={ref} className={`cm-host single-${kind} ${stacked ? 'stacked' : ''}`} />
}
