<script lang="ts">
  import Columns2 from '@lucide/svelte/icons/columns-2'
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'
  import Rows3 from '@lucide/svelte/icons/rows-3'
  import Search from '@lucide/svelte/icons/search'
  import X from '@lucide/svelte/icons/x'
  import { focus } from '../../lib/dom'
  import { keys } from '../../lib/platform'
  import { hint } from '../../state/hint.svelte'
  import { refresh, repo } from '../../state/repo.svelte'
  import { search, searchNow, setText } from '../../state/search.svelte'
  import { browse, click } from '../../state/selection.svelte'

  // Enter opens the first hit, as a search field in an IDE would; the arrows
  // walk over to the log and browse the hits, and Enter there opens one.
  // Either way the keyboard ends up in the log.
  async function onKey(e: KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const hits = await searchNow()
    if (!hits?.length) return
    if (e.key === 'Enter') click(hits[0], { toggle: false, range: false })
    else browse(e.key === 'ArrowDown' ? 1 : -1, hits)
    focus('#log [role="grid"]')
  }
  import { ui } from '../../state/ui.svelte'
  import RepoMenu from './RepoMenu.svelte'
  import ThemeMenu from './ThemeMenu.svelte'
</script>

<div class="flex items-center gap-1.5 h-11 px-2 shrink-0 chrome">
  <div class="flex items-center gap-1.5 flex-1 min-w-0">
    <RepoMenu />
    <div class="flex-1"></div>
    <label class="input input-sm w-72 flex items-center gap-2 px-2.5 text-[12.5px]">
      {#if search.pending}<span class="loading loading-spinner loading-xs"></span>{:else}<Search size={14} strokeWidth={1.75} class="opacity-50" />{/if}
      <input
        id="commit-search"
        class="grow"
        placeholder="Find commit  {keys('mod', 'P')}"
        value={search.text}
        oninput={(e) => setText(e.currentTarget.value)}
        onkeydown={onKey}
        disabled={!repo.info}
      />
      {#if search.text}<button class="btn btn-ghost btn-xs btn-square" onclick={() => setText('')}><X size={13} strokeWidth={1.75} /></button>{/if}
    </label>
    <button class="btn btn-ghost btn-sm btn-square relative" onclick={() => void refresh()} disabled={!repo.info || repo.loading} use:hint={`Reload history  ${keys('mod', 'R')}`}>
      <RefreshCw size={16} strokeWidth={1.75} class={repo.loading ? 'animate-spin' : ''} />
      {#if repo.changedSinceLoad}<span class="status status-warning absolute top-0.5 right-0.5 ring-2 ring-base-100"></span>{/if}
    </button>
    <div role="tablist" class="tabs tabs-box tabs-xs ml-1 p-0.5">
      <button role="tab" class="tab px-1.5" class:tab-active={ui.diffMode === 'split'} class:brand={ui.diffMode === 'split'} class:opacity-60={ui.diffMode !== 'split'} onclick={() => (ui.diffMode = 'split')} use:hint={`Side-by-side diff  ${keys('mod', 'shift', 'D')}`}><Columns2 size={15} strokeWidth={1.75} /></button>
      <button role="tab" class="tab px-1.5" class:tab-active={ui.diffMode === 'unified'} class:brand={ui.diffMode === 'unified'} class:opacity-60={ui.diffMode !== 'unified'} onclick={() => (ui.diffMode = 'unified')} use:hint={`Unified diff  ${keys('mod', 'shift', 'D')}`}><Rows3 size={15} strokeWidth={1.75} /></button>
    </div>
    <ThemeMenu />
  </div>
</div>
