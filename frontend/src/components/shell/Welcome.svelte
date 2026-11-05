<script lang="ts">
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import { abbreviatePath } from '../../lib/format'
  import { menuKeys } from '../../lib/menuKeys'
  import { open, repo } from '../../state/repo.svelte'
  import Logo from './Logo.svelte'
  import Notice from './Notice.svelte'
  import TitleBar from './TitleBar.svelte'
</script>

<div class="h-full flex flex-col">
  <TitleBar />
  <div class="flex-1 flex flex-col items-center justify-center gap-6 p-8">
    <div class="flex items-center gap-4">
      <Logo size={56} />
      <div>
        <div class="text-2xl font-semibold tracking-tight">ginGit</div>
        <div class="text-sm opacity-60">Read-only git history, multi-commit review.</div>
      </div>
    </div>
    <div class="flex flex-col items-stretch gap-2 w-80">
      {#if repo.gitMissing}<Notice kind="error">git was not found on PATH. Install git and restart ginGit.</Notice>
      {:else if repo.error}<Notice kind="error">{repo.error}</Notice>{/if}
      <button class="btn btn-primary btn-sm" onclick={() => void open()}>
        <FolderOpen size={15} strokeWidth={1.75} /> Open repository…
      </button>
      {#if repo.recent.length > 0}
        <ul class="menu menu-sm p-0 mt-2 w-full" id="welcome-recent" use:menuKeys>
          <li class="menu-title text-[10px] text-center">Recent</li>
          {#each repo.recent as r (r.path)}
            <li>
              <button onclick={() => void open(r.path)} title={r.path} class="flex flex-col items-center gap-0 py-1 text-center">
                <span class="font-medium">{r.name}</span>
                <span class="block text-[10px] opacity-50 w-full">{abbreviatePath(r.path)}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</div>
