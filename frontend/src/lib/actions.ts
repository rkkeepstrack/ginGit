import { stepFile } from '../components/diff/DiffPanel'
import { useRepo } from '../state/repoStore'
import { useSearch } from '../state/searchStore'
import { useSelection } from '../state/selectionStore'
import { useUI } from '../state/uiStore'

export type Action =
  | 'open' | 'refresh' | 'search' | 'toggleDiff' | 'escape'
  | 'focusGraph' | 'focusFiles' | 'focusDiff' | 'prevFile' | 'nextFile'
  | 'themeLight' | 'themeDark' | 'themeSystem'

const focus = (selector: string) => (document.querySelector(selector) as HTMLElement | null)?.focus()

/** One implementation behind the native menu, the keyboard and the buttons. */
export function runAction(action: Action, target: HTMLElement | null = document.activeElement as HTMLElement | null) {
  switch (action) {
    case 'open': useSelection.getState().clear(); void useRepo.getState().open(); break
    case 'refresh': void useRepo.getState().refresh(); break
    case 'search': focus('#commit-search'); break
    case 'toggleDiff': useUI.getState().toggleDiffMode(); break
    case 'escape':
      if (target?.id === 'commit-search') { useSearch.getState().setText(''); target.blur() }
      else if (target?.tagName === 'INPUT') target.blur()
      else useSelection.getState().clear()
      break
    case 'focusGraph': focus('#panel-graph [tabindex]'); break
    case 'focusFiles': focus('#panel-files input'); break
    case 'focusDiff': focus('#panel-diff .cm-content'); break
    case 'prevFile': stepFile(-1); break
    case 'nextFile': stepFile(1); break
    case 'themeLight': useUI.getState().setTheme('pastel'); break
    case 'themeDark': useUI.getState().setTheme('dim'); break
    case 'themeSystem': useUI.getState().setTheme('system'); break
  }
}
