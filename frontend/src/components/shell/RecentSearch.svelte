<script lang="ts">
  import Search from '@lucide/svelte/icons/search'
  import { keys } from '../../lib/platform'

  /** The search field atop a menu of recent repositories; Enter takes the first match. */
  let { query = $bindable(), onenter }: { query: string; onenter: () => void } = $props()
</script>

<li class="menu-title px-1 pt-2 pb-1">
  <label class="input input-xs w-full text-base-content font-normal text-[12px]">
    <Search size={12} strokeWidth={1.75} class="opacity-50 shrink-0" />
    <input class="grow min-w-0" placeholder="Search recent  {keys('mod', 'shift', 'O')}" bind:value={query} onkeydown={(e) => { if (e.key === 'Enter' && !e.isComposing) onenter() }} />
  </label>
</li>
