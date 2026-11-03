<script lang="ts">
  import { EditorView, GutterMarker, gutter } from '@codemirror/view'
  import { mountEditor, readOnlyBase } from './editor'

  let { text, path, kind, stacked = false }: { text: string; path: string; kind: 'added' | 'deleted'; stacked?: boolean } = $props()
  let host = $state<HTMLDivElement>()

  // Same 3px bar the merge view draws next to changed lines.
  class BarMarker extends GutterMarker {
    constructor(cls: string) { super(); this.elementClass = cls }
  }
  const bar = (k: 'added' | 'deleted') => {
    const marker = new BarMarker(k === 'added' ? 'cm-changedLineGutter' : 'cm-deletedLineGutter')
    return gutter({ class: 'cm-changeGutter', lineMarker: () => marker })
  }

  // A file that only exists on one side has nothing to compare against, so
  // it gets the full width as plain tinted code.
  $effect(() => {
    if (!host) return
    const [t, p, k] = [text, path, kind]
    return mountEditor(host, p, (el, lang) => new EditorView({ doc: t, extensions: [...readOnlyBase(lang), bar(k)], parent: el }))
  })
</script>

<div bind:this={host} class="cm-host single-{kind}" class:stacked></div>
