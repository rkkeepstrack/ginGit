<script lang="ts">
  import { api, runtime } from '../../lib/api'
  import Logo from './Logo.svelte'

  const MIN_HEIGHT = 36
  // The logo is centred on the traffic lights' own line, wherever macOS put
  // it, and the bar is only as tall as it has to be.
  let center = $state<number | null>(null)
  api.titleBarCenter().then((y) => { if (y > 0) center = y }, () => {})
  const height = $derived(Math.max(MIN_HEIGHT, center ? Math.round(center * 2) : 0))
</script>

<!-- Logo only. It is the window's drag handle, nothing else lives here. -->
<div class="drag-region relative shrink-0 hairline-b text-base-content" style:height="{height}px" ondblclick={() => runtime.toggleMaximise()} role="presentation">
  <div class="absolute left-0 right-0 flex items-center justify-center -translate-y-1/2" style:top="{center ?? height / 2}px">
    <span class="translate-y-[1px]"><Logo size={22} /></span>
    <span class="ml-2 text-[13px] font-semibold tracking-tight">ginGit</span>
  </div>
</div>
