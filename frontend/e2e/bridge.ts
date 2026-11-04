import type { Page } from '@playwright/test'
import fixture from './fixture.json' with { type: 'json' }

type Fixture = typeof fixture

/**
 * Installs a fake Wails bridge (window.go + window.runtime) backed by the
 * fixture, before the app's scripts run. The generated bindings call these
 * globals, so the frontend cannot tell the difference.
 */
export interface BridgeOptions { initialRepo?: boolean; theme?: 'pastel' | 'dim' | 'system'; diffMode?: 'split' | 'unified'; /** path → blob the user supposedly reviewed */ reviewed?: Record<string, string> }

export async function installBridge(page: Page, opts: BridgeOptions = {}) {
  // Repository images, which the Go side serves in the app; the fixture wrote them out.
  await page.route('**/blob/**', (route) => {
    const hash = new URL(route.request().url()).pathname.split('/')[2]
    return route.fulfill({ path: `e2e/fixture-blobs/${hash}.png` })
  })
  await page.addInitScript(({ fx, opts }: { fx: Fixture; opts: BridgeOptions }) => {
    const listeners = new Map<string, ((...data: unknown[]) => void)[]>()
    const emit = (name: string, data: unknown) => { for (const cb of listeners.get(name) ?? []) cb(data) }
    const key = (hashes: string[]) => [...hashes].sort().join(',')
    const fail = (msg: string) => Promise.reject(msg)
    const repoOpen = (root: string) => root === fx.repo.path
    const marks: Record<string, string> = { ...(opts.reviewed ?? {}) }

    localStorage.setItem('gingit-ui', JSON.stringify({ theme: opts.theme ?? 'pastel', diffMode: opts.diffMode ?? 'unified', fileSort: 'name', flatFiles: false }))

    const App = {
      InitialRepository: async () => (opts.initialRepo === false ? '' : fx.repo.path),
      TitleBarCenter: async () => 0,
      OpenRepository: async (path: string) => (path === fx.repo.path ? fx.repo : fail(`not_a_repository: ${path} is not a git repository`)),
      OpenRepositoryDialog: async () => fx.repo,
      RecentRepositories: async () => [{ path: fx.repo.path, name: fx.repo.name, lastOpen: '2026-01-01T00:00:00Z' }],
      ForgetRepository: async () => {},
      Refs: async (root: string) => (repoOpen(root) ? fx.refs : fail('object_not_found: not open')),
      LoadHistory: async (root: string, id: number) => {
        if (!repoOpen(root)) return fail('object_not_found: not open')
        setTimeout(() => {
          emit('history:chunk', { loadId: id, rows: fx.commits })
          emit('history:done', { loadId: id, total: fx.commits.length })
        }, 10)
      },
      ListChanges: async (root: string, hashes: string[]) => {
        const cs = (fx.changes as unknown as Record<string, { files: { path: string }[] }>)[key(hashes)]
        if (!repoOpen(root) || !cs) return fail(`object_not_found: fixture has no change set for ${key(hashes)}`)
        // Reviewable unless the newest selected commit is already on main.
        const byHash = new Map(fx.commits.map((c) => [c.hash, c]))
        const pos = new Map(fx.commits.map((c, i) => [c.hash, i]))
        const newestHash = [...hashes].sort((a, b) => (pos.get(a) ?? 0) - (pos.get(b) ?? 0))[0]
        const mainTip = fx.refs.find((r) => r.full === 'refs/heads/main')?.hash
        const onMain = (() => { const stack = mainTip ? [mainTip] : []; const seen = new Set<string>(); while (stack.length) { const h = stack.pop()!; if (seen.has(h)) continue; seen.add(h); if (h === newestHash) return true; stack.push(...(byHash.get(h)?.parents ?? [])) } return false })()
        const files = cs.files.map((f) => {
          const seen = marks[f.path]
          const newest = ((fx as unknown as { newestBlob: Record<string, string> }).newestBlob)[key(hashes) + '|' + f.path]
          return { ...f, review: onMain || seen === undefined ? '' : seen === newest ? 'reviewed' : 'stale' }
        })
        return { ...cs, files, reviewable: !onMain }
      },
      MarkReviewed: async (_root: string, hashes: string[], path: string, seen: boolean) => {
        if (seen) marks[path] = ((fx as unknown as { newestBlob: Record<string, string> }).newestBlob)[key(hashes) + '|' + path]
        else delete marks[path]
      },
      FileDiffSince: async (root: string, hashes: string[], path: string) => {
        const d = (fx.diffs as Record<string, unknown>)[key(hashes) + '|' + path]
        return repoOpen(root) && d ? d : fail(`object_not_found: fixture has no diff for ${path}`)
      },
      FileDiffs: async (root: string, hashes: string[], paths: string[]) => {
        if (!repoOpen(root)) return fail('object_not_found: not open')
        return Object.fromEntries(paths.map((p) => [p, (fx.diffs as Record<string, unknown>)[key(hashes) + '|' + p]]).filter(([, d]) => d))
      },
      SearchChanges: async (_root: string, hashes: string[], text: string) => {
        const needle = text.toLowerCase()
        const out: Record<string, number> = {}
        if (!needle) return out
        for (const [k, d] of Object.entries(fx.diffs as Record<string, { pairs: { old: { content: string; missing: boolean }; new: { content: string; missing: boolean } }[] }>)) {
          if (!k.startsWith(key(hashes) + '|')) continue
          const path = k.slice(key(hashes).length + 1)
          let n = 0
          for (const p of d.pairs) { const side = p.new.missing ? p.old : p.new; n += side.content.toLowerCase().split(needle).length - 1 }
          if (n > 0) out[path] = n
        }
        return out
      },
      SearchCommits: async (_root: string, text: string) => {
        const t = text.toLowerCase()
        return fx.commits.map((c, i) => (c.subject.toLowerCase().includes(t) || c.hash.startsWith(t) ? i : -1)).filter((i) => i >= 0)
      },
      BranchCommits: async (_root: string, ref: string) => (fx.branches as Record<string, string[]>)[ref] ?? [],
      NameCommits: async (_root: string, hashes: string[]) => Object.fromEntries(hashes.map((h) => [h, (fx.names as Record<string, string>)[h]]).filter(([, n]) => n)),
    }
    ;(window as unknown as { go: unknown }).go = { main: { App } }
    ;(window as unknown as { runtime: unknown }).runtime = {
      EventsOnMultiple: (name: string, cb: (...data: unknown[]) => void) => {
        const list = listeners.get(name) ?? []
        list.push(cb)
        listeners.set(name, list)
        return () => listeners.set(name, (listeners.get(name) ?? []).filter((x) => x !== cb))
      },
      EventsOff: () => {},
      ClipboardSetText: async () => true,
      WindowToggleMaximise: () => {},
      LogPrint: () => {}, LogTrace: () => {}, LogDebug: () => {}, LogInfo: () => {}, LogWarning: () => {}, LogError: () => {}, LogFatal: () => {},
    }
  }, { fx: fixture, opts })
}

export const labels = fixture.labels as Record<string, string>
