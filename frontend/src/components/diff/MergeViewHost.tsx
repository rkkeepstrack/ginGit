import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { MergeView, unifiedMergeView } from '@codemirror/merge'
import { useEffect, useRef } from 'react'
import { highlighting } from '../../lib/highlight'
import { languageFor } from '../../lib/language'
import type { DiffMode } from '../../state/uiStore'

/**
 * Mounts a CodeMirror merge view for one old/new pair. Everything is rebuilt
 * when the inputs change; diffs are short-lived and this keeps the component
 * trivially correct.
 */
export function MergeViewHost({ oldText, newText, path, mode, stacked = false }: {
  oldText: string
  newText: string
  path: string
  mode: DiffMode
  stacked?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = ref.current
    if (!host) return
    let disposed = false
    let view: MergeView | EditorView | null = null

    const build = (lang: Extension | null) => {
      if (disposed || !host) return
      const base: Extension[] = [
        lineNumbers(),
        highlighting,
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        ...(lang ? [lang] : []),
      ]
      const collapse = { margin: 3, minSize: 4 }
      if (mode === 'split') {
        view = new MergeView({
          a: { doc: oldText, extensions: base },
          b: { doc: newText, extensions: base },
          parent: host,
          collapseUnchanged: collapse,
          highlightChanges: true,
          gutter: true,
        })
      } else {
        view = new EditorView({
          doc: newText,
          extensions: [
            ...base,
            unifiedMergeView({
              original: oldText,
              mergeControls: false,
              collapseUnchanged: collapse,
              highlightChanges: true,
              gutter: true,
            }),
          ],
          parent: host,
        })
      }
    }

    languageFor(path).then(build)

    return () => {
      disposed = true
      view?.destroy()
      host.replaceChildren()
    }
  }, [oldText, newText, path, mode])

  return <div ref={ref} className={`cm-host ${stacked ? 'stacked' : ''}`} />
}
