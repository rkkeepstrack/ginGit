export type ThemeChoice = 'system' | 'pastel' | 'dim'
export type DiffMode = 'unified' | 'split'

interface Persisted {
  theme: ThemeChoice
  diffMode: DiffMode
  fileSort: 'name' | 'type'
  flatFiles: boolean
  /** Graph and diff column widths in percent; the files panel takes the rest. */
  panels: [number, number]
}

const KEY = 'gingit-ui'
const defaults: Persisted = { theme: 'system', diffMode: 'split', fileSort: 'name', flatFiles: false, panels: [40, 40] }

function restore(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults
    return { ...defaults, ...JSON.parse(raw) }
  } catch {
    return defaults
  }
}

class UIStore {
  theme = $state<ThemeChoice>(defaults.theme)
  diffMode = $state<DiffMode>(defaults.diffMode)
  fileSort = $state<'name' | 'type'>(defaults.fileSort)
  flatFiles = $state(defaults.flatFiles)
  panels = $state.raw<[number, number]>(defaults.panels)

  constructor() {
    Object.assign(this, restore())
  }

  toggleDiffMode() {
    this.diffMode = this.diffMode === 'split' ? 'unified' : 'split'
  }
}

export const ui = new UIStore()

const dark = window.matchMedia('(prefers-color-scheme: dark)')

/**
 * Always sets an explicit data-theme: the app's own variables (lanes, diff
 * tints, brand) are defined per theme name, so "system" must resolve to one.
 */
function applyTheme(choice: ThemeChoice) {
  const theme = choice === 'system' ? (dark.matches ? 'dim' : 'pastel') : choice
  document.documentElement.setAttribute('data-theme', theme)
}

$effect.root(() => {
  $effect(() => {
    const snapshot: Persisted = { theme: ui.theme, diffMode: ui.diffMode, fileSort: ui.fileSort, flatFiles: ui.flatFiles, panels: ui.panels }
    try { localStorage.setItem(KEY, JSON.stringify(snapshot)) } catch { /* private mode */ }
  })
  $effect(() => applyTheme(ui.theme))
})
dark.addEventListener('change', () => applyTheme(ui.theme))
