<script lang="ts">
  let { additions, deletions }: { additions: number; deletions: number } = $props()
</script>

<span class="text-[11px] tabular-nums shrink-0"><span class="stat-add">+{additions}</span> <span class="stat-del">−{deletions}</span></span>
