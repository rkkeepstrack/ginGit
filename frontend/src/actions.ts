import { tick } from 'svelte'
import { focus } from './lib/dom'
import { stepFile } from './state/changes.svelte'
import { closeFind, find } from './state/find.svelte'
import { open, refresh } from './state/repo.svelte'
import { setText } from './state/search.svelte'
import { clear, selection } from './state/selection.svelte'
import { ui } from './state/ui.svelte'

export type Action =
  | 'open' | 'refresh' | 'search' | 'find' | 'toggleDiff' | 'escape'
  | 'focusLog' | 'focusFiles' | 'focusReview' | 'prevFile' | 'nextFile'
  | 'themeLight' | 'themeDark' | 'themeSystem' | 'diffEditor' | 'diffPatch'

/** DOM anchors the actions need; components set these ids. */
const anchors = {
  search: '#commit-search',
  log: '#log [tabindex]',
  files: '#files input',
  review: '#review .cm-content',
  find: '#find-input',
}

/** One implementation behind the native menu, the keyboard and the buttons. */
export function runAction(action: Action, target: HTMLElement | null = document.activeElement as HTMLElement | null) {
  switch (action) {
    case 'open': void open(); break
    case 'refresh': void refresh(); break
    case 'search': focus(anchors.search); break
    case 'find': if (selection.hashes.length > 0) { find.open = true; void tick().then(() => focus(anchors.find)) } break
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
    case 'diffEditor': ui.diffStyle = 'editor'; break
    case 'diffPatch': ui.diffStyle = 'patch'; break
  }
}
