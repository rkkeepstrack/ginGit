<script lang="ts">
  import FileDiffIcon from '@lucide/svelte/icons/file-diff'
  import { runAction } from './actions'
  import { actionFor } from './lib/shortcuts'
  import { changes } from './state/changes.svelte'
  import { repo } from './state/repo.svelte'
  import { logKey, selection } from './state/selection.svelte'
  import ReviewPanel from './components/review/ReviewPanel.svelte'
  import FilesPanel from './components/files/FilesPanel.svelte'
  import LogPanel from './components/log/LogPanel.svelte'
  import PanelLayout from './components/shell/PanelLayout.svelte'
  import StatusBar from './components/shell/StatusBar.svelte'
  import TitleBar from './components/shell/TitleBar.svelte'
  import Toasts from './components/shell/Toasts.svelte'
  import Toolbar from './components/shell/Toolbar.svelte'
  import Welcome from './components/shell/Welcome.svelte'

  const hasSelection = $derived(selection.hashes.length > 0)

  // Native menu accelerators usually swallow the key before the webview
  // sees it; the keydown path covers the browser dev tab and anything the
  // menu doesn't bind, like [ and ].
  function onKey(e: KeyboardEvent) {
    if (e.isComposing) return
    // Focus nowhere (a dialog just closed, a click on empty space) and only the
    // log on screen: the arrows browse it instead of scrolling the page. With a
    // review open they are left alone; they may be meant for it.
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.metaKey && !e.ctrlKey && !e.altKey && document.activeElement === document.body && !hasSelection) {
      runAction('focusLog')
      logKey(e)
      return
    }
    const action = actionFor(e)
    if (!action) return
    // Handled here means handled: WebKit passes an unhandled Esc on to the native
    // menu, whose Clear Selection would undo the review the Esc just returned to.
    e.preventDefault()
    runAction(action, e.target as HTMLElement | null)
  }
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
      {#snippet left()}<LogPanel />{/snippet}
      {#snippet middle()}
        {#if changes.changeSet && changes.changeSet.files.length > 0}
          <!-- Keyed on the selection so the review starts fresh (folds, fetched diffs) per change set. -->
          {#key changes.changeSet.hashes.join(',')}<ReviewPanel />{/key}
        {:else}
          <div class="h-full flex flex-col items-center justify-center gap-2 text-[12.5px] opacity-40 select-none" id="review">
            <FileDiffIcon size={28} strokeWidth={1.25} />
            {changes.loading ? 'Loading…' : 'No file changes'}
          </div>
        {/if}
      {/snippet}
      {#snippet right()}<FilesPanel />{/snippet}
    </PanelLayout>
    <StatusBar />
    <Toasts />
  </div>
{/if}
