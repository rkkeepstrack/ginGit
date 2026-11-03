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

// App is the Wails-bound facade. It keeps one session per opened repository
// so several windows (or a dev window plus a browser tab) can look at
// different repositories through the same backend.
type App struct {
	ctx    context.Context
	recent *repo.RecentStore

	mu       sync.Mutex
	sessions map[string]*session
	loadSeq  int
}

// session is everything derived from one repository's history.
type session struct {
	root      string
	index     *history.Index
	loadID    int
	cancel    context.CancelFunc
	changes   *changes.Cache
	blobs     *diff.Cache
	branches  *search.Branches
	watcher   *fsnotify.Watcher
	watchStop chan struct{}
}

func newSession(root string) *session {
	return &session{
		root:     root,
		index:    history.NewIndex(),
		changes:  changes.NewCache(64),
		blobs:    diff.NewCache(64 << 20),
		branches: search.NewBranches(),
	}
}

func NewApp() *App {
	return &App{sessions: map[string]*session{}}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	fixFullscreenTitlebar()
	if rs, err := repo.NewRecentStore(); err == nil {
		a.recent = rs
	}
}

func (a *App) shutdown(ctx context.Context) {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, s := range a.sessions {
		s.stopWatcher()
		if s.cancel != nil {
			s.cancel()
		}
	}
}

// get returns the session for root, or an error the frontend can show.
func (a *App) get(root string) (*session, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	s, ok := a.sessions[root]
	if !ok {
		return nil, fmt.Errorf("object_not_found: repository %s is not open", root)
	}
	return s, nil
}

// --- errors ---------------------------------------------------------------

// userError flattens typed errors into something the frontend can switch on.
func userError(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, gitcmd.ErrNotARepository):
		return fmt.Errorf("not_a_repository: %w", err)
	case errors.Is(err, gitcmd.ErrGitNotFound):
		return fmt.Errorf("git_not_found: %w", err)
	case errors.Is(err, gitcmd.ErrTimeout), errors.Is(err, context.DeadlineExceeded):
		return fmt.Errorf("timeout: %w", err)
	case errors.Is(err, gitcmd.ErrObjectNotFound):
		return fmt.Errorf("object_not_found: %w", err)
	case errors.Is(err, changes.ErrNotContiguous):
		return fmt.Errorf("not_contiguous: %w", err)
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

func (a *App) GitVersion() (string, error) {
	return gitcmd.Version(a.ctx)
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
	if _, ok := a.sessions[info.Path]; !ok {
		s := newSession(info.Path)
		s.startWatcher(a.ctx, info.GitDir)
		a.sessions[info.Path] = s
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
	return refs, nil
}

// reset drops everything derived from the previous history load.
func (s *session) reset() {
	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
	}
	s.index = history.NewIndex()
	s.changes.Clear()
	s.blobs.Clear()
	s.branches.Clear()
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

// LoadHistory streams the log of the open repository. Chunks arrive as
// "history:chunk" events tagged with the returned load id; stale ids are to
// be ignored by the frontend.
func (a *App) LoadHistory(root string) (int, error) {
	s, err := a.get(root)
	if err != nil {
		return 0, err
	}
	a.mu.Lock()
	s.reset()
	a.loadSeq++
	id := a.loadSeq
	s.loadID = id
	ctx, cancel := context.WithCancel(a.ctx)
	s.cancel = cancel
	index := s.index
	a.mu.Unlock()

	go func() {
		defer cancel()
		started := time.Now()
		var emitting time.Duration
		total, err := history.Load(ctx, root, history.Options{All: true, ChunkSize: 2500}, func(cs []history.Commit) {
			index.Append(cs)
			t := time.Now()
			wrt.EventsEmit(a.ctx, "history:chunk", HistoryChunk{LoadID: id, Rows: cs})
			emitting += time.Since(t)
		})
		if os.Getenv("GINGIT_DEBUG") != "" {
			log.Printf("history: %d commits in %v (%v spent emitting)", total, time.Since(started), emitting)
		}
		if err != nil && ctx.Err() == nil {
			wrt.EventsEmit(a.ctx, "history:error", HistoryError{LoadID: id, Message: userError(err).Error()})
			return
		}
		if ctx.Err() != nil {
			return
		}
		wrt.EventsEmit(a.ctx, "history:done", HistoryDone{LoadID: id, Total: total})
	}()
	return id, nil
}

func (a *App) CancelHistory(loadID int) {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, s := range a.sessions {
		if s.loadID == loadID && s.cancel != nil {
			s.cancel()
		}
	}
}

// --- changes and diffs ----------------------------------------------------

func (a *App) ListChanges(root string, hashes []string, mode string) (*changes.ChangeSet, error) {
	s, err := a.get(root)
	if err != nil {
		return nil, err
	}
	key := changes.Key(root, hashes, changes.Mode(mode))
	if cs, ok := s.changes.Get(key); ok {
		return cs, nil
	}
	ctx, cancel := context.WithTimeout(a.ctx, 60*time.Second)
	defer cancel()
	cs, err := changes.Compute(ctx, root, s.index, hashes, changes.Mode(mode))
	if err != nil {
		return nil, userError(err)
	}
	s.changes.Put(key, cs)
	return cs, nil
}

func (a *App) FileDiff(root string, hashes []string, mode string, path string) (*diff.Result, error) {
	if err := gitcmd.ValidatePath(path); err != nil {
		return nil, userError(err)
	}
	cs, err := a.ListChanges(root, hashes, mode)
	if err != nil {
		return nil, err
	}
	var fc *changes.FileChange
	for i := range cs.Files {
		if cs.Files[i].Path == path {
			fc = &cs.Files[i]
			break
		}
	}
	if fc == nil {
		return nil, fmt.Errorf("object_not_found: %s is not part of the selection", path)
	}
	s, err := a.get(root)
	if err != nil {
		return nil, err
	}
	subjects := func(h string) string {
		c, _ := s.index.Get(h)
		return c.Subject
	}
	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()
	res, err := diff.ForFile(ctx, root, *fc, subjects, s.blobs)
	if err != nil {
		return nil, userError(err)
	}
	return res, nil
}

// --- search ---------------------------------------------------------------

func (a *App) SearchCommits(root string, q search.Query) ([]int, error) {
	s, err := a.get(root)
	if err != nil {
		return nil, err
	}
	hits, err := search.Run(a.ctx, root, s.index, s.branches, q)
	if err != nil {
		return nil, userError(err)
	}
	return hits, nil
}

// --- watcher --------------------------------------------------------------

// The watcher only lights a dot; it never reloads anything on its own.
func (s *session) startWatcher(ctx context.Context, gitDir string) {
	s.stopWatcher()
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return
	}
	for _, p := range []string{gitDir, filepath.Join(gitDir, "refs", "heads"), filepath.Join(gitDir, "refs", "tags"), filepath.Join(gitDir, "refs", "remotes")} {
		_ = w.Add(p)
	}
	stop := make(chan struct{})
	s.watcher, s.watchStop = w, stop
	root := s.root
	go func() {
		var last time.Time
		for {
			select {
			case <-stop:
				return
			case ev, ok := <-w.Events:
				if !ok {
					return
				}
				base := filepath.Base(ev.Name)
				if base == "index.lock" || base == "index" || filepath.Ext(base) == ".lock" {
					continue
				}
				if time.Since(last) < 500*time.Millisecond {
					continue
				}
				last = time.Now()
				wrt.EventsEmit(ctx, "repo:changed", root)
			case <-w.Errors:
			}
		}
	}()
}

func (s *session) stopWatcher() {
	if s.watcher != nil {
		close(s.watchStop)
		s.watcher.Close()
		s.watcher, s.watchStop = nil, nil
	}
}
