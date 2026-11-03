// Package repo opens and describes repositories and remembers recent ones.
package repo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"ginGit/internal/gitcmd"
)

type Info struct {
	Path   string `json:"path"`
	Name   string `json:"name"`
	Branch string `json:"branch"` // empty when detached
	Head   string `json:"head"`   // full hash
	GitDir string `json:"-"`      // this checkout's git dir: HEAD lives here
	// CommonDir holds refs and packed-refs; for a worktree it is the main
	// repository's .git, otherwise the same as GitDir.
	CommonDir string `json:"-"`
	Detached  bool   `json:"-"`
	Bare      bool   `json:"-"`
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
	bare, err := gitcmd.Run(ctx, abs, "rev-parse", "--is-bare-repository", "--absolute-git-dir", "--git-common-dir")
	if err != nil {
		return Info{}, err
	}
	lines := strings.Split(strings.TrimSpace(string(bare)), "\n")
	if len(lines) != 3 {
		return Info{}, gitcmd.ErrNotARepository
	}
	gitDir := lines[1]
	commonDir := lines[2]
	if !filepath.IsAbs(commonDir) {
		commonDir = filepath.Join(abs, commonDir)
	}
	root := gitDir
	if lines[0] != "true" {
		top, err := gitcmd.Run(ctx, abs, "rev-parse", "--show-toplevel")
		if err != nil {
			return Info{}, err
		}
		root = strings.TrimSpace(string(top))
	}
	info := Info{Path: root, Name: strings.TrimSuffix(filepath.Base(root), ".git"), GitDir: gitDir, CommonDir: commonDir, Bare: lines[0] == "true"}
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

// shortName strips refs/heads/ or refs/remotes/<remote>/ so a branch and its
// remote-tracking counterparts compare equal.
func shortName(full string) string {
	if strings.HasPrefix(full, "refs/heads/") {
		return strings.TrimPrefix(full, "refs/heads/")
	}
	if rest, ok := strings.CutPrefix(full, "refs/remotes/"); ok {
		if _, name, ok := strings.Cut(rest, "/"); ok {
			return name
		}
	}
	return full
}

// BranchCommits lists the branch's own work, newest first: what is reachable
// from ref but not on the first-parent line of any other branch. First-parent
// lines matter twice over: a merged branch sits on main's second parent, so
// main still counts against it; and a branch stacked on top of ref carries
// ref's tip on its first-parent line, so it is left out of the comparison and
// the base of a stack keeps its commits. Remote counterparts of ref are left
// out too, or a lagging origin/x would hide the pushed ones.
func BranchCommits(ctx context.Context, root, ref string) ([]string, error) {
	if !strings.HasPrefix(ref, "refs/") || strings.Contains(ref, "..") || strings.Contains(ref, "\x00") {
		return nil, fmt.Errorf("%w: ref %q", gitcmd.ErrInvalidArg, ref)
	}
	refs, err := Refs(ctx, root)
	if err != nil {
		return nil, err
	}
	var tip string
	for _, r := range refs {
		if r.Full == ref {
			tip = r.Hash
		}
	}
	if tip == "" {
		return nil, fmt.Errorf("%w: ref %s", gitcmd.ErrObjectNotFound, ref)
	}
	out, err := gitcmd.Run(ctx, root, "for-each-ref", "--format=%(refname)", "--contains", tip, "refs/heads", "refs/remotes")
	if err != nil {
		return nil, err
	}
	descends := map[string]bool{}
	for _, name := range strings.Fields(string(out)) {
		descends[name] = true
	}
	var others []string
	for _, r := range refs {
		if r.Kind == "tag" || r.Full == ref || shortName(r.Full) == shortName(ref) {
			continue
		}
		if descends[r.Full] {
			stacked, err := onFirstParentLine(ctx, root, r.Full, tip)
			if err != nil {
				return nil, err
			}
			if stacked {
				continue
			}
		}
		others = append(others, r.Full)
	}
	taken := map[string]bool{}
	if len(others) > 0 {
		out, err := gitcmd.Run(ctx, root, append([]string{"rev-list", "--first-parent"}, append(others, "--")...)...)
		if err != nil {
			return nil, err
		}
		for _, h := range strings.Fields(string(out)) {
			taken[h] = true
		}
	}
	out, err = gitcmd.Run(ctx, root, "rev-list", "--topo-order", ref, "--")
	if err != nil {
		return nil, err
	}
	hashes := []string{}
	for _, h := range strings.Fields(string(out)) {
		if !taken[h] {
			hashes = append(hashes, h)
		}
	}
	return hashes, nil
}

// onFirstParentLine reports whether commit sits on ref's first-parent line.
func onFirstParentLine(ctx context.Context, root, ref, commit string) (bool, error) {
	out, err := gitcmd.Run(ctx, root, "rev-list", "--first-parent", ref, "--")
	if err != nil {
		return false, err
	}
	for _, h := range strings.Fields(string(out)) {
		if h == commit {
			return true, nil
		}
	}
	return false, nil
}

// NameCommits names each commit after the local branch that describes it
// best ("main", "feature/x"), the way `git name-rev` sees it. Commits no
// branch reaches are left out of the result.
func NameCommits(ctx context.Context, root string, hashes []string) (map[string]string, error) {
	if len(hashes) == 0 {
		return map[string]string{}, nil
	}
	for _, h := range hashes {
		if err := gitcmd.ValidateHash(h); err != nil {
			return nil, err
		}
	}
	out, err := gitcmd.RunInput(ctx, root, []byte(strings.Join(hashes, "\n")+"\n"),
		"name-rev", "--name-only", "--refs=refs/heads/*", "--annotate-stdin")
	if err != nil {
		return nil, err
	}
	names := map[string]string{}
	lines := strings.Split(strings.TrimRight(string(out), "\n"), "\n")
	for i, line := range lines {
		if i >= len(hashes) {
			break
		}
		name := strings.TrimSpace(line)
		if name == "" || name == hashes[i] || name == "undefined" {
			continue
		}
		// "main~3^2" → "main"
		if cut := strings.IndexAny(name, "~^"); cut >= 0 {
			name = name[:cut]
		}
		names[hashes[i]] = name
	}
	return names, nil
}
