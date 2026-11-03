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
    if (matches.length > 0 && matches.length <= MAX_NAMED) {
      const names = await api.nameCommits(path, matches.map((i) => repo.commits[i].hash))
      if (gen === generation) search.names = names
    } else {
      search.names = {}
    }
  } catch {
    if (gen === generation) { search.matches = []; search.names = {}; search.pending = false }
  }
}

function schedule() {
  clearTimeout(timer)
  timer = setTimeout(() => void run(), 120)
}

export function setText(text: string) {
  search.text = text
  // Clearing takes effect at once so the graph is back before anything scrolls it.
  if (!text.trim()) { clearTimeout(timer); generation++; search.matches = null; search.names = {}; search.pending = false; return }
  schedule()
}

// Matches are row indices into the history: a reload invalidates them, and the
// search re-runs once the new history has arrived.
$effect.root(() => {
  let lastLoad = 0
  $effect(() => {
    const id = repo.loadId
    if (id !== lastLoad) { lastLoad = id; untrack(() => { search.matches = null; search.names = {} }) }
  })
  let wasLoading = false
  $effect(() => {
    const loading = repo.loading
    if (wasLoading && !loading) untrack(schedule)
    wasLoading = loading
  })
})
