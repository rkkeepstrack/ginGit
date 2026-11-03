<script lang="ts">
  // The logo is Raphael's SVG verbatim; only its size is ours. In the dark
  // theme the #1e1e1e strokes are lifted to the text color by CSS.
  import logo from '../../assets/logo.svg?raw'
  const ASPECT = 72.57 / 101.03 // the SVG's own proportions
  let { size = 20 }: { size?: number } = $props()
</script>

<span class="logo inline-flex shrink-0" style:height="{size}px" style:width="{size * ASPECT}px">{@html logo}</span>
