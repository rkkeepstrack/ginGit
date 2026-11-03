import { EditorView } from '@codemirror/view'
import { MergeView, unifiedMergeView } from '@codemirror/merge'
import type { DiffMode } from '../../state/uiStore'
import { readOnlyBase, useEditorHost } from './useEditorHost'

const collapseUnchanged = { margin: 3, minSize: 4 }

/** A CodeMirror merge view for one old/new pair, side by side or unified. */
export function MergeViewHost({ oldText, newText, path, mode, stacked = false }: {
  oldText: string
  newText: string
  path: string
  mode: DiffMode
  stacked?: boolean
}) {
  const ref = useEditorHost(path, (host, lang) => {
    const base = readOnlyBase(lang)
    if (mode === 'split') {
      return new MergeView({
        a: { doc: oldText, extensions: base },
        b: { doc: newText, extensions: base },
        parent: host,
        collapseUnchanged,
        highlightChanges: true,
        gutter: true,
      })
    }
    return new EditorView({
      doc: newText,
      extensions: [...base, unifiedMergeView({ original: oldText, mergeControls: false, collapseUnchanged, highlightChanges: true, gutter: true })],
      parent: host,
    })
  }, [oldText, newText, path, mode])
  return <div ref={ref} className={`cm-host ${stacked ? 'stacked' : ''}`} />
}
