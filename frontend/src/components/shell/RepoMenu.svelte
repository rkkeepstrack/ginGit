<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import X from '@lucide/svelte/icons/x'
  import { closeDropdown } from '../../lib/dom'
  import { shortenPath } from '../../lib/format'
  import { menuKeys } from '../../lib/menuKeys'
  import { keys } from '../../lib/platform'
  import { hint } from '../../state/hint.svelte'
  import { findRecent, forget, open, repo } from '../../state/repo.svelte'
  import RecentSearch from './RecentSearch.svelte'

  let query = $state('')
  const others = $derived(findRecent(''))
  const recent = $derived(findRecent(query))

  const pick = (path?: string) => {
    void open(path)
    query = ''
    closeDropdown()
  }
</script>

<div class="dropdown" id="repo-menu" use:menuKeys onfocusout={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) query = '' }}>
  <div tabindex="0" role="button" class="btn btn-ghost btn-sm px-2 gap-1 font-semibold text-[13px]" use:hint={`Open a repository  ${keys('mod', 'O')} · a recent one  ${keys('mod', 'shift', 'O')}`}>
    {repo.info?.name ?? 'Open repository'}
    <ChevronDown size={14} strokeWidth={2} class="opacity-50" />
  </div>
  <ul tabindex="-1" class="dropdown-content menu menu-sm bg-base-100 rounded-box shadow-lg z-50 w-[28rem] max-w-[90vw] p-1 mt-1 border border-base-content/10 flex-nowrap overflow-hidden">
    <li><button onclick={() => pick()}><FolderOpen size={15} strokeWidth={1.75} /> Open…</button></li>
    {#if others.length > 0}<RecentSearch bind:query onenter={() => { if (recent[0]) pick(recent[0].path) }} />{/if}
    {#each recent as r (r.path)}
      <li>
        <button class="grid-cols-[minmax(0,1fr)_auto] items-center gap-2" onclick={() => pick(r.path)} title={r.path}>
          <span class="flex-1 min-w-0 overflow-hidden text-left">
            <span class="block font-medium truncate">{r.name}</span>
            <span class="block text-[10px] opacity-50 truncate">{shortenPath(r.path)}</span>
          </span>
          <span
            role="button"
            tabindex="0"
            class="btn btn-ghost btn-xs btn-square opacity-40 hover:opacity-100"
            onclick={(e) => { e.stopPropagation(); void forget(r.path) }}
            onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); void forget(r.path) } }}
            use:hint={'Remove from recent'}
          >
            <X size={13} strokeWidth={1.75} />
          </span>
        </button>
      </li>
    {/each}
    {#if others.length > 0 && recent.length === 0}<li class="menu-disabled"><span class="text-[11.5px]">No match</span></li>{/if}
  </ul>
</div>
