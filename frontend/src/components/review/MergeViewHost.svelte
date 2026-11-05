<script lang="ts">
  import { MergeView, unifiedMergeView } from '@codemirror/merge'
  import { EditorView } from '@codemirror/view'
  import type { DiffMode } from '../../state/ui.svelte'
  import { alignLines, lineDiff } from '../../lib/lineDiff'
  import { markLines } from '../../lib/lineKinds'
  import { mountEditor, readOnlyBase } from './editor'

  let { oldText, newText, path, mode }: { oldText: string; newText: string; path: string; mode: DiffMode } = $props()
  let host = $state<HTMLDivElement>()
  const collapseUnchanged = { margin: 3, minSize: 4 }
  const diffConfig = { override: lineDiff }

  // A CodeMirror merge view for one old/new pair, side by side or unified.
  $effect(() => {
    if (!host) return
    const [a, b, p, m] = [oldText, newText, path, mode]
    return mountEditor(host, p, (el, lang) => {
      const base = readOnlyBase(lang)
      if (m === 'split') {
        const mv = new MergeView({ a: { doc: a, extensions: base }, b: { doc: b, extensions: base }, parent: el, collapseUnchanged, diffConfig, highlightChanges: true, gutter: true })
        const { kindsA, kindsB } = alignLines(a, b)
        markLines(mv.a, kindsA)
        markLines(mv.b, kindsB)
        return { destroy: () => mv.destroy(), views: [mv.b, mv.a] }
      }
      const view = new EditorView({
        doc: b,
        extensions: [...base, unifiedMergeView({ original: a, mergeControls: false, collapseUnchanged, diffConfig, highlightChanges: true, gutter: true })],
        parent: el,
      })
      markLines(view, alignLines(a, b).kindsB)
      return { destroy: () => view.destroy(), views: [view] }
    })
  })
</script>

<div bind:this={host} class="cm-host"></div>
