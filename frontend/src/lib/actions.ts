import { stepFile } from '../state/changes.svelte'
import { open, refresh } from '../state/repo.svelte'
import { setText } from '../state/search.svelte'
import { clear, selection } from '../state/selection.svelte'
import { closeFind, find, openFind } from '../state/find.svelte'
import { ui } from '../state/ui.svelte'

export type Action =
  | 'open' | 'refresh' | 'search' | 'find' | 'toggleDiff' | 'escape'
  | 'focusLog' | 'focusFiles' | 'focusReview' | 'prevFile' | 'nextFile'
  | 'themeLight' | 'themeDark' | 'themeSystem'

/** DOM anchors the actions need; components set these ids. */
export const anchors = {
  search: '#commit-search',
  log: '#log [tabindex]',
  files: '#files input',
  review: '#review .cm-content',
}

const focus = (selector: string) => (document.querySelector(selector) as HTMLElement | null)?.focus()

/** One implementation behind the native menu, the keyboard and the buttons. */
export function runAction(action: Action, target: HTMLElement | null = document.activeElement as HTMLElement | null) {
  switch (action) {
    case 'open': clear(); void open(); break
    case 'refresh': void refresh(); break
    case 'search': focus(anchors.search); break
    case 'find': if (selection.selected.size > 0) openFind(); break
    case 'toggleDiff': ui.toggleDiffMode(); break
    case 'escape':
      if (target?.id === 'find-input' || (find.open && !target?.id)) { closeFind(); break }
      if (target?.id === 'commit-search') { setText(''); target.blur() }
      else if (target?.tagName === 'INPUT') target.blur()
      else clear()
      break
    case 'focusLog': focus(anchors.log); break
    case 'focusFiles': focus(anchors.files); break
    case 'focusReview': focus(anchors.review); break
    case 'prevFile': stepFile(-1); break
    case 'nextFile': stepFile(1); break
    case 'themeLight': ui.theme = 'pastel'; break
    case 'themeDark': ui.theme = 'dim'; break
    case 'themeSystem': ui.theme = 'system'; break
  }
}
