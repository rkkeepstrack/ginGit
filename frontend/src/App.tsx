import { useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { CommitList } from './components/graph/CommitList'
import { ChangesPanel } from './components/files/ChangesPanel'
import { DiffPanel, stepFile } from './components/diff/DiffPanel'
import { TitleBar } from './components/shell/TitleBar'
import { Toolbar } from './components/shell/Toolbar'
import { Welcome } from './components/shell/Welcome'
import { api } from './lib/api'
import { actionFor } from './lib/shortcuts'
import { subscribeRepoEvents, useRepo } from './state/repoStore'
import { useSearch } from './state/searchStore'
import { useSelection } from './state/selectionStore'
import { applyTheme, useUI, watchSystemTheme } from './state/uiStore'

export default function App() {
  const repo = useRepo((s) => s.repo)
  const theme = useUI((s) => s.theme)

  useEffect(() => {
    subscribeRepoEvents()
    watchSystemTheme()
    void useRepo.getState().loadRecent()
    void api.initialRepository().then((p) => { if (p) void useRepo.getState().open(p) })
  }, [])

  useEffect(() => applyTheme(theme), [theme])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = actionFor(e)
      if (!action) return
      const target = e.target as HTMLElement | null
      switch (action) {
        case 'open': e.preventDefault(); useSelection.getState().clear(); void useRepo.getState().open(); break
        case 'refresh': e.preventDefault(); void useRepo.getState().refresh(); break
        case 'search': e.preventDefault(); document.getElementById('commit-search')?.focus(); break
        case 'toggleDiff': e.preventDefault(); useUI.getState().toggleDiffMode(); break
        case 'escape':
          if (target?.id === 'commit-search') { useSearch.getState().setText(''); target.blur() }
          else if (target?.tagName === 'INPUT') target.blur()
          else useSelection.getState().clear()
          break
        case 'focusGraph': e.preventDefault(); (document.querySelector('#panel-graph [tabindex]') as HTMLElement | null)?.focus(); break
        case 'focusFiles': e.preventDefault(); (document.querySelector('#panel-files input') as HTMLElement | null)?.focus(); break
        case 'focusDiff': e.preventDefault(); (document.querySelector('#panel-diff .cm-content') as HTMLElement | null)?.focus(); break
        case 'prevFile': e.preventDefault(); stepFile(-1); break
        case 'nextFile': e.preventDefault(); stepFile(1); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!repo) return <Welcome />

  return (
    <div className="h-full flex flex-col">
      <TitleBar />
      <Toolbar />
      <PanelGroup direction="horizontal" autoSaveId="gingit-panels" className="flex-1 min-h-0">
        <Panel defaultSize={45} minSize={25} className="hairline-r"><CommitList /></Panel>
        <PanelResizeHandle className="resize-handle w-px bg-base-content/10" />
        <Panel defaultSize={20} minSize={12} className="hairline-r"><ChangesPanel /></Panel>
        <PanelResizeHandle className="resize-handle w-px bg-base-content/10" />
        <Panel defaultSize={35} minSize={20}><DiffPanel /></Panel>
      </PanelGroup>
    </div>
  )
}
