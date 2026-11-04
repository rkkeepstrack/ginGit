import { untrack } from 'svelte'
import { ApiError, api } from '../lib/api'
import { collectMatches, highlightMatches, revealMatch, type Match } from './editors'
import { recoverIfNotOpen, repo } from './repo.svelte'
import { selection } from './selection.svelte'

/**
 * Find in the changes on screen. The backend says which files of the
 * selection contain the text (so their sections open and load); the mounted
 * editors highlight and step through the occurrences.
 */
class FindStore {
  open = $state(false)
  query = $state('')
  /** Per file, how many times the text occurs in its diff; null while nothing is searched. */
  counts = $state.raw<Record<string, number> | null>(null)
  pending = $state(false)
  matches = $state.raw<Match[]>([])
  index = $state(-1)
  total = $derived(this.counts ? Object.values(this.counts).reduce((a, b) => a + b, 0) : 0)
  files = $derived(this.counts ? Object.keys(this.counts).length : 0)
}

export const find = new FindStore()

let timer: ReturnType<typeof setTimeout> | undefined
let generation = 0

async function run() {
  const text = find.query.trim()
  const path = repo.info?.path
  highlightMatches(text)
  if (!path || !text || selection.hashes.length === 0) {
    find.counts = null
    find.pending = false
    find.matches = []
    find.index = -1
    return
  }
  const gen = ++generation
  find.pending = true
  try {
    const counts = await api.searchChanges(path, selection.hashes, text)
    if (gen !== generation) return
    find.counts = counts
    find.pending = false
    find.index = -1
  } catch (e) {
    if (gen !== generation) return
    if (!recoverIfNotOpen(e as ApiError)) find.counts = {}
    find.pending = false
  }
}

export function closeFind() {
  find.open = false
  find.query = ''
  clearTimeout(timer)
  void run()
}

export function setQuery(q: string) {
  find.query = q
  clearTimeout(timer)
  timer = setTimeout(() => void run(), 150)
}

/** Steps to the next (or previous) occurrence among the editors on screen. */
export function step(delta: 1 | -1) {
  const matches = collectMatches()
  find.matches = matches
  if (matches.length === 0) return
  const next = (find.index + delta + matches.length) % matches.length
  find.index = next
  revealMatch(matches[next])
}

// A new selection means new files: search again so the sections follow.
$effect.root(() => {
  $effect(() => {
    void selection.hashes
    untrack(() => { if (find.query.trim()) { clearTimeout(timer); void run() } })
  })
})
