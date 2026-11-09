// Package gittest builds throwaway repositories with scripted histories so
// the aggregation and diff code can be tested against real git behaviour.
package gittest

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// Repo is a temporary repository. Every method fails the test on error.
type Repo struct {
	T    *testing.T
	Path string
	// Hashes records every commit by the label passed to Commit.
	Hashes map[string]string
}

func New(t *testing.T) *Repo {
	t.Helper()
	dir := t.TempDir()
	r := &Repo{T: t, Path: dir, Hashes: map[string]string{}}
	r.Git("init", "-q", "-b", "main")
	r.Git("config", "user.email", "test@example.com")
	r.Git("config", "user.name", "Test")
	r.Git("config", "commit.gpgsign", "false")
	return r
}

func (r *Repo) Git(args ...string) string {
	r.T.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = r.Path
	cmd.Env = append(os.Environ(),
		"GIT_AUTHOR_DATE=2024-01-01T00:00:00Z", "GIT_COMMITTER_DATE=2024-01-01T00:00:00Z",
		"GIT_CONFIG_GLOBAL=/dev/null", "GIT_CONFIG_SYSTEM=/dev/null", "LC_ALL=C")
	out, err := cmd.CombinedOutput()
	if err != nil {
		r.T.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return strings.TrimSpace(string(out))
}

func (r *Repo) Write(path, content string) {
	r.T.Helper()
	full := filepath.Join(r.Path, path)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		r.T.Fatal(err)
	}
	if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
		r.T.Fatal(err)
	}
}

func (r *Repo) Remove(path string) {
	r.T.Helper()
	if err := os.Remove(filepath.Join(r.Path, path)); err != nil {
		r.T.Fatal(err)
	}
}

func (r *Repo) Rename(from, to string) {
	r.T.Helper()
	full := filepath.Join(r.Path, to)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		r.T.Fatal(err)
	}
	if err := os.Rename(filepath.Join(r.Path, from), full); err != nil {
		r.T.Fatal(err)
	}
}

// Commit stages everything and commits it, recording the resulting hash
// under the message's first line.
func (r *Repo) Commit(message string) string {
	r.T.Helper()
	r.Git("add", "-A")
	r.Git("commit", "-q", "--allow-empty", "-m", message)
	h := r.Git("rev-parse", "HEAD")
	r.Hashes[strings.SplitN(message, "\n", 2)[0]] = h
	return h
}

func (r *Repo) Branch(name string)   { r.T.Helper(); r.Git("checkout", "-q", "-b", name) }
func (r *Repo) Checkout(name string) { r.T.Helper(); r.Git("checkout", "-q", name) }

func (r *Repo) Merge(label, branch string) string {
	r.T.Helper()
	r.Git("merge", "-q", "--no-ff", "--no-edit", "-m", label, branch)
	h := r.Git("rev-parse", "HEAD")
	r.Hashes[label] = h
	return h
}

func (r *Repo) CherryPick(label, hash string) string {
	r.T.Helper()
	r.Git("cherry-pick", hash)
	h := r.Git("rev-parse", "HEAD")
	r.Hashes[label] = h
	return h
}

func (r *Repo) H(label string) string {
	r.T.Helper()
	h, ok := r.Hashes[label]
	if !ok {
		r.T.Fatalf("no commit labelled %q", label)
	}
	return h
}
