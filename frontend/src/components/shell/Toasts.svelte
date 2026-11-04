<script lang="ts">
  import Check from '@lucide/svelte/icons/check'
  import { hints } from '../../state/hint.svelte'
</script>

<!-- Short confirmations ("Copied …") as a pill above the status bar. -->
{#if hints.flash}
  <div class="toast toast-center toast-bottom z-50 mb-8 pointer-events-none">
    <div class="flex items-center gap-2 rounded-box py-1.5 px-3 text-[12px] shadow-md border border-base-content/10 bg-base-100 text-base-content">
      <Check size={14} strokeWidth={2} class="brand" />
      <span>{hints.flash}</span>
    </div>
  </div>
{/if}
