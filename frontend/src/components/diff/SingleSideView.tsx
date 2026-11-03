import { EditorView, GutterMarker, gutter } from '@codemirror/view'
import { readOnlyBase, useEditorHost } from './useEditorHost'

// Same 3px bar the merge view draws next to changed lines.
class BarMarker extends GutterMarker {
  constructor(cls: string) { super(); this.elementClass = cls }
}
const bar = (kind: 'added' | 'deleted') => {
  const marker = new BarMarker(kind === 'added' ? 'cm-changedLineGutter' : 'cm-deletedLineGutter')
  return gutter({ class: 'cm-changeGutter', lineMarker: () => marker })
}

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
  const ref = useEditorHost(path, (host, lang) => new EditorView({
    doc: text,
    extensions: [...readOnlyBase(lang), bar(kind)],
    parent: host,
  }), [text, path, kind])
  return <div ref={ref} className={`cm-host single-${kind} ${stacked ? 'stacked' : ''}`} />
}
