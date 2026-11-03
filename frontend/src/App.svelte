<script lang="ts">
  import { events } from './lib/api'
  import { runAction, type Action } from './lib/actions'
  import { actionFor } from './lib/shortcuts'
  import { repo } from './state/repo.svelte'
  import { selection } from './state/selection.svelte'
  import DiffPanel from './components/diff/DiffPanel.svelte'
  import ChangesPanel from './components/files/ChangesPanel.svelte'
  import CommitList from './components/graph/CommitList.svelte'
  import PanelLayout from './components/shell/PanelLayout.svelte'
  import StatusBar from './components/shell/StatusBar.svelte'
  import TitleBar from './components/shell/TitleBar.svelte'
  import Toasts from './components/shell/Toasts.svelte'
  import Toolbar from './components/shell/Toolbar.svelte'
  import Welcome from './components/shell/Welcome.svelte'

  const hasSelection = $derived(selection.selected.size > 0)

  // Native menu accelerators usually swallow the key before the webview
  // sees it; the keydown path covers the browser dev tab and anything the
  // menu doesn't bind, like [ and ].
  function onKey(e: KeyboardEvent) {
    const action = actionFor(e)
    if (!action) return
    if (action !== 'escape') e.preventDefault()
    runAction(action, e.target as HTMLElement | null)
  }
  $effect(() => events.onMenu((action) => runAction(action as Action)))
</script>

<!-- No browser context menu; it only offers "Inspect Element" and friends. -->
<svelte:window onkeydown={onKey} oncontextmenu={(e) => e.preventDefault()} />

{#if !repo.info}
  <Welcome />
{:else}
  <div class="h-full flex flex-col">
    <TitleBar />
    <Toolbar />
    <!-- One list instance throughout: with nothing selected it simply takes the whole width. -->
    <PanelLayout single={!hasSelection}>
      {#snippet left()}<CommitList />{/snippet}
      {#snippet middle()}<DiffPanel />{/snippet}
      {#snippet right()}<ChangesPanel />{/snippet}
    </PanelLayout>
    <StatusBar />
    <Toasts />
  </div>
{/if}
