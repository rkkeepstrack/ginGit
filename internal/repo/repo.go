// Package repo opens and describes repositories and remembers recent ones.
package repo

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"ginGit/internal/gitcmd"
)

type Info struct {
	Path     string `json:"path"`
	Name     string `json:"name"`
	Branch   string `json:"branch"` // empty when detached
	Head     string `json:"head"`   // full hash
	GitDir   string `json:"gitDir"` // absolute .git dir, for the watcher
	Detached bool   `json:"detached"`
	Bare     bool   `json:"bare"`
}

type Ref struct {
	Name   string `json:"name"` // short name: main, origin/main, v1.2
	Full   string `json:"full"` // refs/heads/main
	Hash   string `json:"hash"`
	Kind   string `json:"kind"`   // head, remote, tag
	IsHead bool   `json:"isHead"` // current branch
}

// Open validates path and describes the repository. Path may be any
// directory inside the work tree; the top level is returned.
func Open(ctx context.Context, path string) (Info, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return Info{}, err
	}
	if st, err := os.Stat(abs); err != nil || !st.IsDir() {
		return Info{}, gitcmd.ErrNotARepository
	}
	bare, err := gitcmd.Run(ctx, abs, "rev-parse", "--is-bare-repository", "--absolute-git-dir")
	if err != nil {
		return Info{}, err
	}
	lines := strings.Split(strings.TrimSpace(string(bare)), "\n")
	if len(lines) != 2 {
		return Info{}, gitcmd.ErrNotARepository
	}
	gitDir := lines[1]
	root := gitDir
	if lines[0] != "true" {
		top, err := gitcmd.Run(ctx, abs, "rev-parse", "--show-toplevel")
		if err != nil {
			return Info{}, err
		}
		root = strings.TrimSpace(string(top))
	}
	info := Info{Path: root, Name: strings.TrimSuffix(filepath.Base(root), ".git"), GitDir: gitDir, Bare: lines[0] == "true"}
	if head, err := gitcmd.Run(ctx, root, "rev-parse", "HEAD"); err == nil {
		info.Head = strings.TrimSpace(string(head))
	}
	// Empty repository: no HEAD yet. Still a repository.
	if br, err := gitcmd.Run(ctx, root, "rev-parse", "--abbrev-ref", "HEAD"); err == nil {
		b := strings.TrimSpace(string(br))
		if b == "HEAD" {
			info.Detached = true
		} else {
			info.Branch = b
		}
	}
	return info, nil
}

// Refs lists branches, remote branches and tags.
func Refs(ctx context.Context, root string) ([]Ref, error) {
	out, err := gitcmd.Run(ctx, root, "for-each-ref",
		"--format=%(refname)%00%(objectname)%00%(*objectname)%00%(HEAD)",
		"refs/heads", "refs/remotes", "refs/tags")
	if err != nil {
		return nil, err
	}
	var refs []Ref
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		f := strings.Split(line, "\x00")
		if len(f) < 4 {
			continue
		}
		r := Ref{Full: f[0], Hash: f[1], IsHead: f[3] == "*"}
		// Annotated tags: point at the commit, not the tag object.
		if f[2] != "" {
			r.Hash = f[2]
		}
		switch {
		case strings.HasPrefix(r.Full, "refs/heads/"):
			r.Kind, r.Name = "head", strings.TrimPrefix(r.Full, "refs/heads/")
		case strings.HasPrefix(r.Full, "refs/remotes/"):
			r.Kind, r.Name = "remote", strings.TrimPrefix(r.Full, "refs/remotes/")
			if strings.HasSuffix(r.Name, "/HEAD") {
				continue
			}
		case strings.HasPrefix(r.Full, "refs/tags/"):
			r.Kind, r.Name = "tag", strings.TrimPrefix(r.Full, "refs/tags/")
		default:
			continue
		}
		refs = append(refs, r)
	}
	return refs, nil
}

// Recent persists the recently opened repositories.
type Recent struct {
	Path     string    `json:"path"`
	Name     string    `json:"name"`
	LastOpen time.Time `json:"lastOpen"`
}

type RecentStore struct {
	file string
	mu   sync.Mutex
}

func NewRecentStore() (*RecentStore, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	dir = filepath.Join(dir, "ginGit")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &RecentStore{file: filepath.Join(dir, "recent.json")}, nil
}

const maxRecent = 15

func (s *RecentStore) List() ([]Recent, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.load()
}

func (s *RecentStore) load() ([]Recent, error) {
	data, err := os.ReadFile(s.file)
	if errors.Is(err, os.ErrNotExist) {
		return []Recent{}, nil
	}
	if err != nil {
		return nil, err
	}
	var list []Recent
	if err := json.Unmarshal(data, &list); err != nil {
		return []Recent{}, nil // corrupt file: start over rather than refuse to launch
	}
	return list, nil
}

func (s *RecentStore) Touch(info Info) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	list, err := s.load()
	if err != nil {
		return err
	}
	out := []Recent{{Path: info.Path, Name: info.Name, LastOpen: time.Now()}}
	for _, r := range list {
		if r.Path != info.Path {
			out = append(out, r)
		}
	}
	if len(out) > maxRecent {
		out = out[:maxRecent]
	}
	data, _ := json.MarshalIndent(out, "", "  ")
	return os.WriteFile(s.file, data, 0o644)
}

func (s *RecentStore) Remove(path string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	list, err := s.load()
	if err != nil {
		return err
	}
	out := list[:0]
	for _, r := range list {
		if r.Path != path {
			out = append(out, r)
		}
	}
	data, _ := json.MarshalIndent(out, "", "  ")
	return os.WriteFile(s.file, data, 0o644)
}
