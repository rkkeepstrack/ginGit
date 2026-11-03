<script lang="ts">
  import type { Snippet } from 'svelte'
  import { ui } from '../../state/ui.svelte'

  let { left, middle, right }: { left: Snippet; middle: Snippet; right: Snippet } = $props()

  const MIN = [20, 20, 12] // percent, per panel
  let host = $state<HTMLDivElement>()

  // Dragging a handle moves one boundary; the other stays where it is.
  function drag(handle: 0 | 1) {
    return (e: PointerEvent) => {
      if (!host) return
      e.preventDefault()
      const width = host.clientWidth
      const start = e.clientX
      const [l0, m0] = ui.panels
      const move = (ev: PointerEvent) => {
        const delta = ((ev.clientX - start) / width) * 100
        if (handle === 0) {
          const l = Math.min(Math.max(MIN[0], l0 + delta), 100 - MIN[2] - m0)
          ui.panels = [l, m0]
        } else {
          const m = Math.min(Math.max(MIN[1], m0 + delta), 100 - MIN[2] - l0)
          ui.panels = [l0, m]
        }
      }
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }
  }
</script>

<div bind:this={host} class="flex-1 min-h-0 flex">
  <div class="min-w-0 min-h-0" style:width="{ui.panels[0]}%">{@render left()}</div>
  <div class="resize-handle" onpointerdown={drag(0)} role="separator" aria-orientation="vertical"></div>
  <div class="min-w-0 min-h-0" style:width="{ui.panels[1]}%">{@render middle()}</div>
  <div class="resize-handle" onpointerdown={drag(1)} role="separator" aria-orientation="vertical"></div>
  <div class="min-w-0 min-h-0 flex-1">{@render right()}</div>
</div>
