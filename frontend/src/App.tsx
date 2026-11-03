import { useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { CommitList } from './components/graph/CommitList'
import { ChangesPanel } from './components/files/ChangesPanel'
import { DiffPanel } from './components/diff/DiffPanel'
import { TitleBar } from './components/shell/TitleBar'
import { Toolbar } from './components/shell/Toolbar'
import { StatusBar } from './components/shell/StatusBar'
import { Toasts } from './components/shell/Toasts'
import { Welcome } from './components/shell/Welcome'
import { api, events } from './lib/api'
import { runAction, type Action } from './lib/actions'
import { actionFor } from './lib/shortcuts'
import { subscribeRepoEvents, useRepo } from './state/repoStore'
import { useSelection } from './state/selectionStore'
import { applyTheme, useUI, watchSystemTheme } from './state/uiStore'

export default function App() {
  const repo = useRepo((s) => s.repo)
  const theme = useUI((s) => s.theme)
  const hasSelection = useSelection((s) => s.selected.size > 0)

  useEffect(() => {
    subscribeRepoEvents()
    watchSystemTheme()
    void useRepo.getState().loadRecent()
    void api.initialRepository().then((p) => { if (p) void useRepo.getState().open(p) })
  }, [])

  useEffect(() => applyTheme(theme), [theme])

  useEffect(() => {
    // Native menu accelerators usually swallow the key before the webview
    // sees it; the keydown path covers the browser dev tab and anything the
    // menu doesn't bind, like [ and ].
    const onKey = (e: KeyboardEvent) => {
      const action = actionFor(e)
      if (!action) return
      if (action !== 'escape') e.preventDefault()
      runAction(action, e.target as HTMLElement | null)
    }
    // No browser context menu; it only offers "Inspect Element" and friends.
    const onContext = (e: MouseEvent) => e.preventDefault()
    window.addEventListener('keydown', onKey)
    window.addEventListener('contextmenu', onContext)
    const offMenu = events.onMenu((action) => runAction(action as Action))
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('contextmenu', onContext); offMenu() }
  }, [])

  if (!repo) return <Welcome />

  return (
    <div className="h-full flex flex-col">
      <TitleBar />
      <Toolbar />
      {hasSelection ? (
        <PanelGroup direction="horizontal" autoSaveId="gingit-panels-v2" className="flex-1 min-h-0">
          <Panel defaultSize={40} minSize={25} className="hairline-r"><CommitList /></Panel>
          <PanelResizeHandle className="resize-handle w-px bg-base-content/10" />
          <Panel defaultSize={40} minSize={20} className="hairline-r"><DiffPanel /></Panel>
          <PanelResizeHandle className="resize-handle w-px bg-base-content/10" />
          <Panel defaultSize={20} minSize={12}><ChangesPanel /></Panel>
        </PanelGroup>
      ) : (
        // Nothing selected: the history gets the whole window.
        <div className="flex-1 min-h-0"><CommitList /></div>
      )}
      <StatusBar />
      <Toasts />
    </div>
  )
}
