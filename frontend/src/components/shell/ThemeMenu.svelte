<script lang="ts">
  import Check from '@lucide/svelte/icons/check'
  import Monitor from '@lucide/svelte/icons/monitor'
  import Moon from '@lucide/svelte/icons/moon'
  import Sun from '@lucide/svelte/icons/sun'
  import SunMoon from '@lucide/svelte/icons/sun-moon'
  import { closeDropdown } from '../../lib/dom'
  import { hint } from '../../state/hint.svelte'
  import { ui, type DiffStyle, type ThemeChoice } from '../../state/ui.svelte'

  const choices: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
    { value: 'pastel', label: 'Light', icon: Sun },
    { value: 'dim', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]
  // One dot per colour the style uses.
  const diffStyles: { value: DiffStyle; label: string; hint: string; dots: string[] }[] = [
    { value: 'editor', label: 'Editor', hint: 'New lines green, changed lines blue, removed lines gray, as in an IDE', dots: ['#20c997', '#228be6', '#8a94a6'] },
    { value: 'patch', label: 'Patch', hint: 'Added lines green, removed lines red, as in a pull request', dots: ['#2f9e44', '#e03131'] },
  ]
  const choose = (value: ThemeChoice) => { ui.theme = value; closeDropdown() }
  const chooseDiff = (value: DiffStyle) => { ui.diffStyle = value; closeDropdown() }
</script>

<div class="dropdown dropdown-end">
  <div tabindex="0" role="button" class="btn btn-ghost btn-sm btn-square" use:hint={'Appearance: theme and diff style'}>
    <SunMoon size={16} strokeWidth={1.75} />
  </div>
  <ul tabindex="-1" class="dropdown-content menu menu-sm bg-base-100 rounded-box shadow-lg z-50 w-40 p-1 mt-1 border border-base-content/10">
    {#each choices as c (c.value)}
      <li>
        <button class="grid-cols-[auto_1fr_auto]" onclick={() => choose(c.value)}>
          <c.icon size={14} strokeWidth={1.75} />
          {c.label}
          {#if ui.theme === c.value}<Check size={13} strokeWidth={2} />{:else}<span></span>{/if}
        </button>
      </li>
    {/each}
    <li class="menu-title text-[10px] pt-2">Diff style</li>
    {#each diffStyles as d (d.value)}
      <li>
        <button class="grid-cols-[auto_1fr_auto]" onclick={() => chooseDiff(d.value)} use:hint={d.hint}>
          <span class="inline-flex gap-0.5 w-[22px]">
            {#each d.dots as dot (dot)}<span class="w-1.5 h-1.5 rounded-full" style:background={dot}></span>{/each}
          </span>
          {d.label}
          {#if ui.diffStyle === d.value}<Check size={13} strokeWidth={2} />{:else}<span></span>{/if}
        </button>
      </li>
    {/each}
  </ul>
</div>
