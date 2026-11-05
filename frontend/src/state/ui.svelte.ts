export type ThemeChoice = 'system' | 'pastel' | 'dim'
export type DiffMode = 'unified' | 'split'
/** Editor: new green, changed blue, removed gray, like an IDE. Patch: green and red, like a pull request. */
export type DiffStyle = 'editor' | 'patch'

interface Persisted {
  theme: ThemeChoice
  diffMode: DiffMode
  fileSort: 'name' | 'type'
  flatFiles: boolean
  diffStyle: DiffStyle
  /** Graph and diff column widths in percent; the files panel takes the rest. */
  panels: [number, number]
}

const KEY = 'gingit-ui'
const defaults: Persisted = { theme: 'system', diffMode: 'split', fileSort: 'name', flatFiles: false, diffStyle: 'editor', panels: [40, 40] }

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
  diffStyle = $state<DiffStyle>(defaults.diffStyle)
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
    const snapshot: Persisted = { theme: ui.theme, diffMode: ui.diffMode, fileSort: ui.fileSort, flatFiles: ui.flatFiles, diffStyle: ui.diffStyle, panels: ui.panels }
    try { localStorage.setItem(KEY, JSON.stringify(snapshot)) } catch { /* private mode */ }
  })
  $effect(() => applyTheme(ui.theme))
  $effect(() => { document.documentElement.dataset.diff = ui.diffStyle })
})
dark.addEventListener('change', () => applyTheme(ui.theme))
