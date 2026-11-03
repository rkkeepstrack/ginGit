<script lang="ts">
  // The logo is Raphael's SVG verbatim; only its size is ours. In the dark
  // theme the #1e1e1e strokes are lifted to the text color by CSS.
  import logo from '../../assets/logo.svg?raw'
  let { size = 20 }: { size?: number } = $props()
</script>

<span class="logo inline-flex shrink-0" style:height="{size}px" style:width="{size * 0.624}px">{@html logo}</span>
