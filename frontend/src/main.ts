import { mount } from 'svelte'
import App from './App.svelte'
import './index.css'
import { runAction, type Action } from './actions'
import { api, events } from './lib/api'
import { loadRecent, open, repo, subscribeRepoEvents } from './state/repo.svelte'
import { search, setText } from './state/search.svelte'
import { selection, selectMany } from './state/selection.svelte'
import { ui } from './state/ui.svelte'

// Process-lifetime wiring, done once, outside the component tree.
subscribeRepoEvents()
events.onMenu((action) => runAction(action as Action))
void loadRecent()
void api.initialRepository().then((p) => { if (p) void open(p) })

if (import.meta.env.DEV) {
  // Scripting hook for driving the app from devtools or a CDP session.
  ;(window as unknown as { __gingit: unknown }).__gingit = { repo, selection, search, ui, open, setText, selectMany }
}

mount(App, { target: document.getElementById('root')! })
