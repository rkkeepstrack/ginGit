import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { api } from './lib/api'
import { subscribeRepoEvents, useRepo } from './state/repoStore'
import { useSelection } from './state/selectionStore'
import { useSearch } from './state/searchStore'
import { applyTheme, followSystemTheme, useUI } from './state/uiStore'

// Process-lifetime wiring, done once, outside React.
subscribeRepoEvents()
applyTheme(useUI.getState().theme)
followSystemTheme()
useUI.subscribe((s, prev) => { if (s.theme !== prev.theme) applyTheme(s.theme) })
void useRepo.getState().loadRecent()
void api.initialRepository().then((p) => { if (p) void useRepo.getState().open(p) })

if (import.meta.env.DEV) {
  // Scripting hook for driving the app from devtools or a CDP session.
  ;(window as unknown as { __gingit: unknown }).__gingit = { useRepo, useSelection, useSearch, useUI }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
