<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ChevronUp from '@lucide/svelte/icons/chevron-up'
  import Search from '@lucide/svelte/icons/search'
  import X from '@lucide/svelte/icons/x'
  import { plural } from '../../lib/format'
  import { keys } from '../../lib/platform'
  import { closeFind, find, setQuery, step } from '../../state/find.svelte'
  import { hint } from '../../state/hint.svelte'

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1) }
    if (e.key === 'Escape') { e.preventDefault(); closeFind() }
  }
  const summary = $derived(
    find.pending ? 'searching…'
      : !find.query.trim() ? ''
      : find.total === 0 ? 'no matches'
      : `${plural(find.total, 'match', 'matches')} in ${plural(find.files, 'file')}${find.index >= 0 ? ` · ${find.index + 1} of ${find.matches.length} on screen` : ''}`,
  )
</script>

<div class="flex items-center gap-2 px-2 h-9 hairline-b shrink-0 bg-base-200/50 text-[12px]">
  <label class="input input-xs w-72 flex items-center gap-2 px-2">
    <Search size={13} strokeWidth={1.75} class="opacity-50" />
    <input id="find-input" class="grow" placeholder="Find in changes  {keys('mod', 'F')}" value={find.query} oninput={(e) => setQuery(e.currentTarget.value)} onkeydown={onKey} />
  </label>
  <span class="opacity-60 tabular-nums whitespace-nowrap">{summary}</span>
  <div class="flex-1"></div>
  <button class="btn btn-ghost btn-xs btn-square" onclick={() => step(-1)} disabled={find.total === 0} use:hint={`Previous match  ${keys('shift', 'Enter')}`}><ChevronUp size={14} strokeWidth={1.75} /></button>
  <button class="btn btn-ghost btn-xs btn-square" onclick={() => step(1)} disabled={find.total === 0} use:hint={'Next match  Enter'}><ChevronDown size={14} strokeWidth={1.75} /></button>
  <button class="btn btn-ghost btn-xs btn-square" onclick={closeFind} use:hint={'Close  Esc'}><X size={14} strokeWidth={1.75} /></button>
</div>
