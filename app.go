package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	wrt "github.com/wailsapp/wails/v2/pkg/runtime"

	"ginGit/internal/changes"
	"ginGit/internal/diff"
	"ginGit/internal/gitcmd"
	"ginGit/internal/history"
	"ginGit/internal/repo"
	"ginGit/internal/search"
)

// App is the Wails-bound facade. It holds the one open repository and what
// was derived from its history; opening another repository replaces all of it.
type App struct {
	ctx    context.Context
	recent *repo.RecentStore

	mu       sync.Mutex
	root     string
	refs     []repo.Ref // as last listed for the frontend
	index    *history.Index
	cancel   context.CancelFunc // stops the running history load
	watcher  *fsnotify.Watcher
	changes  *changes.Cache
	blobs    *diff.Cache
	branches *search.Branches
}

func NewApp() *App {
	return &App{
		index:    history.NewIndex(),
		changes:  changes.NewCache(64),
		blobs:    diff.NewCache(64 << 20),
		branches: search.NewBranches(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	fixFullscreenTitlebar()
	if rs, err := repo.NewRecentStore(); err == nil {
		a.recent = rs
	}
}

func (a *App) shutdown(context.Context) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.dropLocked()
}

// dropLocked stops everything tied to the current history.
func (a *App) dropLocked() {
	if a.cancel != nil {
		a.cancel()
		a.cancel = nil
	}
	a.index = history.NewIndex()
	a.refs = nil
	a.changes.Clear()
	a.blobs.Clear()
	a.branches.Clear()
}

// open checks root is the open repository and returns the current index.
func (a *App) open(root string) (*history.Index, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if root != a.root {
		return nil, fmt.Errorf("object_not_found: repository %s is not open", root)
	}
	return a.index, nil
}

// userError prefixes known failures with a kind the frontend can switch on.
func userError(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, gitcmd.ErrNotARepository):
		return fmt.Errorf("not_a_repository: %w", err)
	case errors.Is(err, gitcmd.ErrGitNotFound):
		return fmt.Errorf("git_not_found: %w", err)
	case errors.Is(err, context.DeadlineExceeded):
		return fmt.Errorf("timeout: %w", err)
	case errors.Is(err, gitcmd.ErrObjectNotFound):
		return fmt.Errorf("object_not_found: %w", err)
	case errors.Is(err, context.Canceled):
		return fmt.Errorf("cancelled: %w", err)
	}
	return err
}

// --- repository -----------------------------------------------------------

// InitialRepository is the path given on the command line (or GINGIT_REPO),
// so `ginGit .` from a terminal opens straight into the graph.
func (a *App) InitialRepository() string {
	if len(os.Args) > 1 && !strings.HasPrefix(os.Args[1], "-") {
		return os.Args[1]
	}
	return os.Getenv("GINGIT_REPO")
}

// TitleBarCenter is the vertical centre of the window controls from the top
// edge, in CSS pixels, or 0 where the platform draws no such thing.
func (a *App) TitleBarCenter() float64 {
	y := trafficLightCenterY()
	if os.Getenv("GINGIT_DEBUG") != "" {
		log.Printf("titlebar: traffic lights centred %.1fpt from the top", y)
	}
	return y
}

func (a *App) OpenRepository(path string) (repo.Info, error) {
	info, err := repo.Open(a.ctx, path)
	if errors.Is(err, gitcmd.ErrNotARepository) {
		return repo.Info{}, fmt.Errorf("not_a_repository: %s is not a git repository", path)
	}
	if err != nil {
		return repo.Info{}, userError(err)
	}
	a.mu.Lock()
	if info.Path != a.root {
		a.dropLocked()
		a.root = info.Path
		a.startWatcherLocked(info.GitDir, info.CommonDir)
	}
	a.mu.Unlock()
	if a.recent != nil {
		_ = a.recent.Touch(info)
	}
	return info, nil
}

func (a *App) OpenRepositoryDialog() (repo.Info, error) {
	dir, err := wrt.OpenDirectoryDialog(a.ctx, wrt.OpenDialogOptions{Title: "Open repository"})
	if err != nil {
		return repo.Info{}, err
	}
	if dir == "" {
		return repo.Info{}, fmt.Errorf("cancelled: no directory chosen")
	}
	return a.OpenRepository(dir)
}

func (a *App) RecentRepositories() ([]repo.Recent, error) {
	if a.recent == nil {
		return []repo.Recent{}, nil
	}
	return a.recent.List()
}

func (a *App) ForgetRepository(path string) error {
	if a.recent == nil {
		return nil
	}
	return a.recent.Remove(path)
}

func (a *App) Refs(root string) ([]repo.Ref, error) {
	refs, err := repo.Refs(a.ctx, root)
	if err != nil {
		return nil, userError(err)
	}
	if refs == nil {
		refs = []repo.Ref{}
	}
	a.mu.Lock()
	if root == a.root {
		a.refs = refs
	}
	a.mu.Unlock()
	return refs, nil
}

// BranchCommits is the work on one branch, computed over the loaded index.
func (a *App) BranchCommits(root string, ref string) ([]string, error) {
	index, err := a.open(root)
	if err != nil {
		return nil, err
	}
	refs, err := a.refsFor(root)
	if err != nil {
		return nil, userError(err)
	}
	tips := make([]history.RefTip, len(refs))
	for i, r := range refs {
		tips[i] = history.RefTip{Full: r.Full, Hash: r.Hash, Tag: r.Kind == "tag"}
	}
	hashes, ok := index.BranchCommits(tips, ref)
	if !ok {
		return nil, fmt.Errorf("object_not_found: %s is not in the loaded history yet", ref)
	}
	return hashes, nil
}

// refsFor returns the refs as last listed for the frontend, or lists them.
func (a *App) refsFor(root string) ([]repo.Ref, error) {
	a.mu.Lock()
	refs := a.refs
	a.mu.Unlock()
	if refs != nil {
		return refs, nil
	}
	return repo.Refs(a.ctx, root)
}

// --- history --------------------------------------------------------------

type HistoryChunk struct {
	LoadID int              `json:"loadId"`
	Rows   []history.Commit `json:"rows"`
}

type HistoryDone struct {
	LoadID int `json:"loadId"`
	Total  int `json:"total"`
}

type HistoryError struct {
	LoadID  int    `json:"loadId"`
	Message string `json:"message"`
}

// LoadHistory streams the log of the open repository as "history:chunk"
// events tagged with the caller's load id. The frontend picks the id so it
// can record it before the first event can possibly land; a tiny repo
// finishes before a round trip completes.
func (a *App) LoadHistory(root string, id int) error {
	if _, err := a.open(root); err != nil {
		return err
	}
	a.mu.Lock()
	a.dropLocked()
	ctx, cancel := context.WithCancel(a.ctx)
	a.cancel = cancel
	index := a.index
	a.mu.Unlock()

	go func() {
		defer cancel()
		started := time.Now()
		var emitting time.Duration
		total, err := history.Load(ctx, root, history.Options{ChunkSize: 2500}, func(cs []history.Commit) {
			index.Append(cs)
			t := time.Now()
			wrt.EventsEmit(a.ctx, "history:chunk", HistoryChunk{LoadID: id, Rows: cs})
			emitting += time.Since(t)
		})
		if os.Getenv("GINGIT_DEBUG") != "" {
			log.Printf("history: %d commits in %v (%v spent emitting)", total, time.Since(started), emitting)
		}
		switch {
		case ctx.Err() != nil:
			// Abandoned by a newer load; say nothing.
		case err != nil:
			wrt.EventsEmit(a.ctx, "history:error", HistoryError{LoadID: id, Message: userError(err).Error()})
		default:
			wrt.EventsEmit(a.ctx, "history:done", HistoryDone{LoadID: id, Total: total})
		}
	}()
	return nil
}

// --- changes and diffs ----------------------------------------------------

func (a *App) ListChanges(root string, hashes []string) (*changes.ChangeSet, error) {
	index, err := a.open(root)
	if err != nil {
		return nil, err
	}
	key := changes.Key(hashes)
	if cs, ok := a.changes.Get(key); ok {
		return cs, nil
	}
	cs, err := changes.Compute(a.ctx, root, index, hashes)
	if err != nil {
		return nil, userError(err)
	}
	a.changes.Put(key, cs)
	return cs, nil
}

func (a *App) FileDiff(root string, hashes []string, path string) (*diff.Result, error) {
	if err := gitcmd.ValidatePath(path); err != nil {
		return nil, userError(err)
	}
	cs, err := a.ListChanges(root, hashes)
	if err != nil {
		return nil, err
	}
	for _, fc := range cs.Files {
		if fc.Path == path {
			res, err := diff.ForFile(a.ctx, root, fc, a.blobs)
			if err != nil {
				return nil, userError(err)
			}
			return res, nil
		}
	}
	return nil, fmt.Errorf("object_not_found: %s is not part of the selection", path)
}

// --- search ---------------------------------------------------------------

func (a *App) SearchCommits(root string, q search.Query) ([]int, error) {
	index, err := a.open(root)
	if err != nil {
		return nil, err
	}
	hits, err := search.Run(a.ctx, root, index, a.branches, q)
	if err != nil {
		return nil, userError(err)
	}
	return hits, nil
}

// NameCommits labels commits with the branch that describes them best, for
// search results where the graph can't show lanes.
func (a *App) NameCommits(root string, hashes []string) (map[string]string, error) {
	if _, err := a.open(root); err != nil {
		return nil, err
	}
	names, err := repo.NameCommits(a.ctx, root, hashes)
	if err != nil {
		return nil, userError(err)
	}
	return names, nil
}

// --- watcher --------------------------------------------------------------

// The watcher only lights a dot; it never reloads anything on its own. HEAD
// changes in this checkout's git dir, ref changes in the common one.
func (a *App) startWatcherLocked(gitDir, commonDir string) {
	if a.watcher != nil {
		a.watcher.Close()
		a.watcher = nil
	}
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return
	}
	for _, p := range []string{gitDir, commonDir, filepath.Join(commonDir, "refs", "heads"), filepath.Join(commonDir, "refs", "tags"), filepath.Join(commonDir, "refs", "remotes")} {
		_ = w.Add(p)
	}
	a.watcher = w
	root := a.root
	go func() {
		var last time.Time
		for {
			select {
			case ev, ok := <-w.Events:
				if !ok {
					return
				}
				base := filepath.Base(ev.Name)
				if base == "index" || filepath.Ext(base) == ".lock" {
					continue
				}
				if time.Since(last) < 500*time.Millisecond {
					continue
				}
				last = time.Now()
				wrt.EventsEmit(a.ctx, "repo:changed", root)
			case _, ok := <-w.Errors:
				if !ok {
					return
				}
			}
		}
	}()
}
