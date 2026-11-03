import { useRepo } from '../state/repoStore'
import { useSearch } from '../state/searchStore'
import { stepFile } from '../state/changesStore'
import { useSelection } from '../state/selectionStore'
import { useUI } from '../state/uiStore'

export type Action =
  | 'open' | 'refresh' | 'search' | 'toggleDiff' | 'escape'
  | 'focusGraph' | 'focusFiles' | 'focusDiff' | 'prevFile' | 'nextFile'
  | 'themeLight' | 'themeDark' | 'themeSystem'

/** DOM anchors the actions need; components set these ids. */
export const anchors = {
  search: '#commit-search',
  graph: '#panel-graph [tabindex]',
  files: '#panel-files input',
  diff: '#panel-diff .cm-content',
}

const focus = (selector: string) => (document.querySelector(selector) as HTMLElement | null)?.focus()

/** One implementation behind the native menu, the keyboard and the buttons. */
export function runAction(action: Action, target: HTMLElement | null = document.activeElement as HTMLElement | null) {
  switch (action) {
    case 'open': useSelection.getState().clear(); void useRepo.getState().open(); break
    case 'refresh': void useRepo.getState().refresh(); break
    case 'search': focus(anchors.search); break
    case 'toggleDiff': useUI.getState().toggleDiffMode(); break
    case 'escape':
      if (target?.id === 'commit-search') { useSearch.getState().setText(''); target.blur() }
      else if (target?.tagName === 'INPUT') target.blur()
      else useSelection.getState().clear()
      break
    case 'focusGraph': focus(anchors.graph); break
    case 'focusFiles': focus(anchors.files); break
    case 'focusDiff': focus(anchors.diff); break
    case 'prevFile': stepFile(-1); break
    case 'nextFile': stepFile(1); break
    case 'themeLight': useUI.getState().setTheme('pastel'); break
    case 'themeDark': useUI.getState().setTheme('dim'); break
    case 'themeSystem': useUI.getState().setTheme('system'); break
  }
}
