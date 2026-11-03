import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { useRepo } from './state/repoStore'
import { useSelection } from './state/selectionStore'
import { useSearch } from './state/searchStore'
import { useUI } from './state/uiStore'

if (import.meta.env.DEV) {
  // Scripting hook for driving the app from devtools or a CDP session.
  ;(window as unknown as { __gingit: unknown }).__gingit = { useRepo, useSelection, useSearch, useUI }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
