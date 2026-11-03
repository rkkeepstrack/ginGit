<script lang="ts">
  import GitBranch from '@lucide/svelte/icons/git-branch'
  import Tag from '@lucide/svelte/icons/tag'
  import type { Ref } from '../../lib/types'
  import { flashMessage, hint } from '../../state/hint.svelte'
  import { setText } from '../../state/search.svelte'
  import { selectBranch } from '../../state/selection.svelte'

  let { r }: { r: Ref } = $props()

  /** Click: review the ref's own commits, drop any search, and scroll to its tip. */
  async function pick() {
    try {
      const message = await selectBranch(r, { reveal: true })
      setText('')
      if (message) flashMessage(message)
    } catch (e) {
      flashMessage((e as Error).message)
    }
  }
</script>

<!-- One branch or tag label. The same thing on a tip and on a search hit. -->
<button
  type="button"
  class="ref-pill {r.isHead ? 'head' : r.kind === 'head' ? 'branch' : r.kind}"
  onmousedown={(e) => e.stopPropagation()}
  onclick={(e) => { e.stopPropagation(); void pick() }}
  use:hint={`${r.full} · click to review its commits`}
>
  {#if r.kind === 'tag'}<Tag size={11} strokeWidth={2} />{:else}<GitBranch size={11} strokeWidth={2} />{/if}
  {r.name}
</button>
