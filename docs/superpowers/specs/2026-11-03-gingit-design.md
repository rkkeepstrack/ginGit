# ginGit design

Date: 2026-11-03
Status: approved for planning

## 1. Purpose

ginGit is a read-only desktop application for exploring Git history and reviewing
changes across several commits at once. It is modeled on the Git Log tool window
in JetBrains WebStorm and is meant to sit next to Zed, whose built-in history view
is not good enough for detailed review.

The defining feature: select any number of commits (Cmd/Ctrl-click, Shift-click),
see every file they touched in one consolidated list, click a file, see its diff
with syntax highlighting in unified or side-by-side mode, and move between files
without opening individual commits.

The application never writes to a repository.

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Desktop framework | Wails v2 (v2.16 installed, stable) |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS 4, daisyUI 5. Light theme `pastel`, dark theme `dim` |
| Diff viewer | CodeMirror 6 with `@codemirror/merge` (side-by-side `MergeView`, `unifiedMergeView`) |
| Syntax highlighting | `@codemirror/language-data`, grammars loaded lazily by file extension |
| Commit graph | Lanes computed in Go, rendered as a small SVG per visible row, rows virtualized with TanStack Virtual |
| Git access | git CLI through `os/exec` with argument lists, no shell, no go-git |
| History loading | One streamed full `git log --topo-order --all`, pushed to the frontend in chunks over Wails events |
| State | Zustand stores |
| Panels | react-resizable-panels, three columns: graph, files, diff |
| Platforms | macOS and Linux |
| Code font | JetBrains Mono, bundled |
| Logo | `assets/logo.svg` (gin glass), source of the app icon |

## 3. Architecture

Wails v2 application. The Go side owns everything that touches git. The frontend
owns selection state, layout and rendering. They communicate through Wails
bindings (request/response) and Wails events (streaming history chunks, progress,
repository-changed notifications).

### 3.1 Go packages

Each package has one job and can be tested on its own.

- `internal/gitcmd`
  The only package that executes git. API: `Run(ctx, repoPath, args...)` and
  `Stream(ctx, repoPath, args...)` returning an `io.Reader`. Every call gets a
  context with a timeout. Argument validation lives here:
  - full hashes must match `^[0-9a-f]{40}$`; user-typed prefixes `^[0-9a-f]{7,40}$`
  - paths must not start with `-` and are always passed after a `--` separator
  - subcommand allowlist: `rev-parse`, `log`, `diff-tree`, `diff`, `cat-file`,
    `show-ref`, `for-each-ref`, `status`
  - `GIT_TERMINAL_PROMPT=0`, `LC_ALL=C`, and `-c core.quotepath=off` on every call
    so output is parseable
- `internal/repo`
  Open and validate a repository (`rev-parse --show-toplevel`, `--git-dir`),
  repository name, current branch or detached HEAD hash, refs via
  `for-each-ref`, recent-repositories list persisted as JSON in the user config
  directory (`os.UserConfigDir()/ginGit/recent.json`).
- `internal/history`
  Streams `git log --topo-order --all --parents` with a NUL-separated format
  (`%H%x00%P%x00%an%x00%ae%x00%aI%x00%cI%x00%s%x00%b%x1e`) through a scanner,
  turns each record into a `Commit`, feeds it to `graph.Layout`, and emits chunks
  of 1000 rows through a callback. The facade turns callbacks into Wails events.
- `internal/graph`
  Pure lane-assignment algorithm. Input: commits in topo order with parent
  hashes. Output per row: node lane, color index, and edge segments
  `(fromLane, toLane, colorIndex)` to draw toward the next row. No git, no I/O.
- `internal/changes`
  Builds the consolidated file list for a selection in Range or Aggregate mode
  (rules in section 5). Owns the result cache keyed by repo path, sorted hashes,
  and mode.
- `internal/diff`
  Fetches old and new blob contents for one file at two commits through
  `cat-file --batch`, detects binary content (NUL byte in the first 8 KB), caps
  each side at 2 MB, and returns both sides with git's numstat for the file.
- `internal/search`
  Filters the in-memory commit list by message, author, hash prefix, branch
  membership, and date range. Branch membership comes from a per-branch
  `rev-list` computed lazily and cached. Plain Go filtering; results in
  milliseconds for 50k commits.
- `app.go`
  The Wails-bound facade. Exposes typed methods and wires events. No logic of
  its own beyond cancellation bookkeeping.

### 3.2 Wails API surface

```go
OpenRepository(path string) (RepoInfo, error)
OpenRepositoryDialog() (RepoInfo, error)      // native directory picker
RecentRepositories() ([]RecentRepo, error)
LoadHistory(repoPath string) (loadID int, err error)   // streams events
CancelHistory(loadID int)
ListChanges(repoPath string, hashes []string, mode Mode) (ChangeSet, error)
FileDiff(repoPath string, hashes []string, mode Mode, path string) (FileDiffResult, error)
SearchCommits(repoPath string, q SearchQuery) ([]string, error)   // matching hashes
Refs(repoPath string) ([]Ref, error)
```

Events: `history:chunk {loadID, rows}`, `history:done {loadID, total}`,
`history:error {loadID, message}`, `repo:changed {repoPath}`.

### 3.3 Frontend modules (`frontend/src`)

- `state/repoStore.ts`: open repo, refs, commits array (append-only during a
  load), load progress, load generation counter.
- `state/selectionStore.ts`: selected hashes as an ordered set, shift anchor,
  active mode, derived `isContiguous` (computed from local parent data).
- `state/uiStore.ts`: theme, panel sizes, diff view mode, filters, column
  widths, persisted to `localStorage`.
- `components/graph/`: `CommitList` (virtualized), `CommitRow`, `LaneCell`
  (SVG), `RefPills`.
- `components/files/`: `ChangeTree`, `ChangeRow`, `FileFilter`, tree builder in
  `lib/fileTree.ts`.
- `components/diff/`: `DiffPanel`, `MergeViewHost` (CodeMirror wrapper),
  `StackedDiffs`, `DiffHeader`.
- `components/shell/`: `Toolbar`, `PanelLayout`, `RepoMenu`, `ThemeToggle`,
  `FilterPopover`.
- `lib/wails.ts`: typed wrappers over the generated bindings and event
  subscriptions. The rest of the frontend never imports `wailsjs` directly.
- `lib/shortcuts.ts`: single keymap, platform-aware modifier.

## 4. Data flow

1. The user opens a repository. Go validates it and returns name, branch and refs.
2. The frontend calls `LoadHistory`. Go starts a goroutine, streams git log,
   assigns lanes, emits `history:chunk` events of about 1000 rows, then
   `history:done`. The frontend appends chunks and renders after the first one.
3. The user selects commits. The selection store checks contiguity locally and
   enables Range mode only when the selection qualifies.
4. The frontend calls `ListChanges`. Go computes or serves from cache.
5. The user clicks a file. The frontend calls `FileDiff`. Go returns one or more
   old/new content pairs. CodeMirror renders them.
6. Refresh re-runs steps 1 and 2 and clears caches. An fsnotify watcher on
   `.git/HEAD`, `.git/refs/`, and `.git/packed-refs` emits `repo:changed`, which
   only lights a dot on the refresh button. History never reloads on its own,
   because that would destroy the current selection.

Cancellation: switching repositories or refreshing mid-load cancels the
goroutine through its context. Both sides carry a load generation counter and
drop chunks from a stale load.

## 5. Aggregation rules

A selection is a set of commits S. A commit's own change is its diff against its
first parent. A root commit is diffed against the empty tree
(`4b825dc642cb6eb9a060e54bf8d69288fbee4904`).

### 5.1 Range mode (snapshot comparison)

Allowed only when S, sorted in topo order, forms a chain where each commit's
first parent is the next selected commit. The result is one snapshot diff from
`oldest^` to `newest`:

```
git diff-tree -r -M --no-commit-id --name-status -z oldest^ newest
git diff-tree -r -M --no-commit-id --numstat     -z oldest^ newest
```

UI label: `Range: a1b2c3d..e4f5g6h · n commits`.

### 5.2 Aggregate mode (per-commit union)

Always allowed. For each commit in S run the same two `diff-tree` commands
against its first parent, then union by final path. Each file entry carries:

- the touching commits in topo order (newest first, matching the list)
- combined change type: `added` if the earliest touch added it, `deleted` if the
  latest touch deleted it, `renamed` if any touch renamed it (final path shown,
  original path as a hint), otherwise `modified`
- summed additions and deletions
- `touches` = number of touching commits, shown as `×N` when N > 1
- `consecutive` = whether the touching commits form a contiguous first-parent
  chain

UI label: `Aggregate · n commits`.

### 5.3 Per-file diff

Range mode: old side is the blob at `oldest^`, new side is the blob at `newest`.

Aggregate mode, file touched by one commit: old side at `commit^`, new side at
`commit`.

Aggregate mode, file touched by several consecutive commits: old side at
`earliest^`, new side at `latest`. This equals the composition of the individual
diffs, so one patch is correct.

Aggregate mode, non-consecutive touches: return each touching commit's own diff
for the file. The viewer stacks them vertically with a divider showing the
commit's short hash and subject, and a note: "These commits are not consecutive,
so their changes to this file can't be merged into a single patch." The file
list marks such files with an icon so the user knows before clicking.

### 5.4 Special cases

- Merge commits: diffed against first parent only. Row and file-list header show
  a merge badge; its tooltip explains the diff shows what the merge brought into
  the branch. Second-parent diffs are out of scope.
- Renames: git's `-M` detection with the default threshold. Shown as
  `old → new`. A file renamed in one selected commit and modified in another is
  keyed by its final path. Rename plus later delete resolves to `deleted`.
- Cherry-picks need no special handling. Selecting an original and its
  cherry-pick yields `×2` and the stacked view, since they are never consecutive.
- Submodules appear as a single `modified` entry with no diff.
- Binary files and files over 2 MB per side show a notice instead of a diff.

## 6. Commit graph layout

Classic lane algorithm, run in Go as commits stream in:

- Keep an ordered list of active lanes, each holding the hash it is waiting for.
- A commit lands in the first lane waiting for it, or a new rightmost lane.
- Its first parent inherits the lane. Other parents join an existing lane that
  already waits for them or open a new lane.
- Lanes with no remaining expectation close and everything right of them shifts
  left.
- Output per row: node lane, color index, segments `(fromLane, toLane, color)`
  into the next row.

Colors cycle through 8 pastel lane colors assigned at branch birth, so a branch
keeps its color as it moves between lanes.

Rendering: fixed row height 28 px, lane width 14 px, SVG cell width capped at 12
lanes with lanes beyond the cap faded. Filled dot for regular commits, hollow
circle for merges, ring for HEAD. Ref pills (branch, tag, HEAD, remote) before
the subject, overflow collapsed into a `+n` pill.

Columns: graph, subject with pills, author, relative date (absolute on hover),
short hash. Widths resizable and persisted.

## 7. UI and interaction

Layout: toolbar on top, three resizable panels below. Default split 45 / 20 / 35.

Toolbar: repository dropdown (recent repos, "Open…"), current branch, search
box, branch filter, filter button (author, date range), refresh with the
changed-dot, unified/side-by-side toggle, theme toggle.

Selection:

- Click selects one. Cmd/Ctrl-click toggles one. Shift-click selects the range
  from the anchor to the clicked row in list order. Escape clears.
- Up/Down move the selection; Shift-Up/Down extend it.
- Files panel header shows `3 commits selected` and a segmented control
  Range / Aggregate. Range is disabled with a tooltip when the selection is not
  contiguous.

Files panel: directory tree, expanded two levels by default, flat-list toggle,
path filter box, sort by name or change type. Rows show a change-type letter in
a pastel badge (A, M, D, R), the `×N` badge, the non-consecutive icon, and
`+a −d` right-aligned.

Diff panel: path breadcrumb, change-type badge, old and new short hashes,
unified/side-by-side toggle. CodeMirror merge view with line numbers on both
sides, unchanged regions collapsed to 3 context lines with expand gutters,
read-only. `[` and `]` or Cmd/Ctrl-Up/Down move to the previous or next file.

Themes: daisyUI `pastel` (light) and `dim` (dark), following the OS by default
with a persisted manual override. Diff and lane colors are CSS variables defined
per theme.

Shortcuts: Cmd/Ctrl-O open, Cmd/Ctrl-R refresh, Cmd/Ctrl-F focus search,
Cmd/Ctrl-Shift-D toggle diff mode, Cmd/Ctrl-1/2/3 focus a panel, Escape clear
selection or search. Cmd on macOS, Ctrl on Linux.

## 8. Error handling

Go returns typed errors: `ErrNotARepository`, `ErrGitNotFound`, `ErrTimeout`,
`ErrObjectNotFound`, `ErrRepoMoved`, `ErrTooLarge`, `ErrBinary`. The frontend
maps them to inline notices inside the panel that failed. No modal dialogs. A
failed history load keeps the chunks already received and shows a retry bar.

## 9. Performance

- History: one streamed pass, 1000-row chunks, lanes computed incrementally.
  Target: first rows visible under 300 ms, 50k commits fully loaded under 3 s on
  Apple Silicon.
- Lists: commit list and file tree virtualized.
- Caches in Go: change sets by (repo, hashes, mode); file diffs by (repo,
  oldBlob, newBlob). Both LRU, bounded, cleared on refresh.
- Search runs over in-memory metadata; branch membership cached per branch.

## 10. Testing

- `internal/graph`: unit tests on hand-built DAGs (linear, branch and merge,
  octopus, criss-cross, orphan root, long-lived parallel branches).
- `internal/changes`, `internal/diff`: tests against temporary repositories
  created by a helper that scripts git. Cases: add, modify, delete, rename,
  modify-after-rename, rename-then-delete, merge, cherry-pick, file touched in
  three commits with a gap, root commit, binary file. Each asserts the exact
  file list, change types, stats, and the consecutive decision.
- `internal/gitcmd`: argument validation, path starting with `-` rejected,
  disallowed subcommand rejected.
- Frontend: Vitest for `selectionStore` (anchor, shift ranges, contiguity) and
  `lib/fileTree.ts`.
- `make check`: `go vet`, `go test ./...`, `tsc --noEmit`, `eslint`, `vitest`.

## 11. Phases

Each phase ends with a runnable application.

1. Foundation: scaffold, logo and icon, themes, open repository, streamed
   history, graph with lanes and ref pills.
2. Selection and aggregation: selection store, Range and Aggregate in Go with
   tests, consolidated file tree.
3. Diff viewer: CodeMirror merge view, both modes, stacked diffs, file
   navigation.
4. Polish: search and filters, shortcuts, recent repos, watcher, error states,
   performance pass against a 50k-commit clone.

## 12. Out of scope

Anything that writes to a repository, second-parent merge diffs, submodule
contents, blame, per-file history, remote hosting integrations, Windows builds.

## 13. Revisions after the first day of use (2026-11-03)

- Range mode is gone from the UI and the backend. Every review is the
  aggregate of the selected commits' own changes. Per-file composability
  uses blob continuity (each touch starts from the blob the previous one
  produced), not commit adjacency.
- Branch, author and date filters are gone; search covers message, author
  and hash. The toolbar no longer shows the checked-out branch, the graph
  shows all refs anyway.
- Columns are not user-resizable. The subject column keeps priority and the
  author, date and hash columns give way in that order as the panel narrows.
- With nothing selected the history takes the whole window. With a selection
  and no file chosen, the diff panel shows every file as a collapsible
  section (GitHub style); clicking a file opens it on its own.
- The backend holds one repository at a time. The frontend picks the history
  load id so no event can arrive before it is recorded.
- Hints live in a status bar, confirmations in toasts; the native menu bar
  carries the shortcuts.
