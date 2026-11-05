import { untrack } from 'svelte'
import { api } from '../lib/api'
import { repo } from './repo.svelte'

/** Naming is one git call; beyond this many hits the badges are not worth it. */
const MAX_NAMED = 2000

class SearchStore {
  text = $state('')
  /** Commit indices matching the text, or null when nothing is filtering. */
  matches = $state.raw<number[] | null>(null)
  /** Branch each match sits on; stands in for the graph while filtering. */
  names = $state.raw<Record<string, string>>({})
  pending = $state(false)
}

export const search = new SearchStore()

let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0

async function run() {
  const text = search.text.trim()
  const path = repo.info?.path
  if (!path || !text) {
    search.matches = null
    search.names = {}
    search.pending = false
    return
  }
  const gen = ++generation
  search.pending = true
  try {
    const matches = await api.searchCommits(path, text)
    if (gen !== generation) return
    search.matches = matches
    search.pending = false
    void label(gen, path, matches)
  } catch {
    if (gen === generation) { search.matches = []; search.names = {}; search.pending = false }
  }
}

/** The branch each hit sits on: a second git call, which nobody waits for. */
async function label(gen: number, path: string, matches: number[]) {
  if (matches.length === 0 || matches.length > MAX_NAMED) {
    search.names = {}
    return
  }
  try {
    const names = await api.nameCommits(path, matches.map((i) => repo.commits[i].hash))
    if (gen === generation) search.names = names
  } catch {
    /* labels are a convenience */
  }
}

let scheduled = false
let running: Promise<void> | null = null

function start() {
  scheduled = false
  running = run()
  return running
}

function schedule() {
  clearTimeout(timer)
  scheduled = true
  timer = setTimeout(() => void start(), 120)
}

/**
 * The hits for what's typed now: a search still waiting starts at once, one
 * already running is waited for, so Enter never acts on stale hits.
 */
export async function searchNow(): Promise<number[] | null> {
  if (scheduled) {
    clearTimeout(timer)
    await start()
  } else if (search.pending && running) await running
  return search.matches
}

export function setText(text: string) {
  search.text = text
  // Clearing takes effect at once so the graph is back before anything scrolls it.
  if (!text.trim()) { clearTimeout(timer); scheduled = false; generation++; search.matches = null; search.names = {}; search.pending = false; return }
  schedule()
}

// Matches are row indices into the history: a load in progress invalidates
// them (and any answer still in flight), and the search re-runs once the new
// history has arrived.
$effect.root(() => {
  $effect(() => {
    void repo.loadId
    const loading = repo.loading
    untrack(() => {
      generation++
      search.matches = null
      search.names = {}
      search.pending = false
      if (!loading) schedule()
    })
  })
})
