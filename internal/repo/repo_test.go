package repo

import (
	"context"
	"errors"
	"strings"
	"testing"

	"ginGit/internal/gitcmd"
	"ginGit/internal/gittest"
)

func TestOpenAndRefs(t *testing.T) {
	r := gittest.New(t)
	r.Write("a", "a")
	r.Commit("one")
	r.Git("tag", "v1")
	r.Git("tag", "-a", "v2", "-m", "annotated")
	r.Branch("feature")

	info, err := Open(context.Background(), r.Path+"/.")
	if err != nil {
		t.Fatal(err)
	}
	if info.Branch != "feature" || info.Head != r.H("one") || info.Detached {
		t.Errorf("info %+v", info)
	}
	refs, err := Refs(context.Background(), info.Path)
	if err != nil {
		t.Fatal(err)
	}
	kinds := map[string]Ref{}
	for _, ref := range refs {
		kinds[ref.Name] = ref
	}
	if kinds["feature"].Kind != "head" || !kinds["feature"].IsHead || kinds["main"].IsHead {
		t.Errorf("heads wrong: %+v", refs)
	}
	if kinds["v2"].Kind != "tag" || kinds["v2"].Hash != r.H("one") {
		t.Errorf("annotated tag should resolve to the commit: %+v", kinds["v2"])
	}
}

func TestOpenWorktree(t *testing.T) {
	r := gittest.New(t)
	r.Write("a", "a")
	r.Commit("one")
	wt := t.TempDir() + "/wt"
	r.Git("worktree", "add", "-q", "-b", "feature", wt)
	info, err := Open(context.Background(), wt)
	if err != nil {
		t.Fatal(err)
	}
	// macOS reports the temp dir through /private; compare the resolved path.
	if info.Branch != "feature" || !strings.HasSuffix(info.Path, "/wt") {
		t.Errorf("%+v", info)
	}
	// HEAD is the worktree's own; refs live in the main checkout's .git.
	if !strings.Contains(info.GitDir, "/worktrees/") || strings.Contains(info.CommonDir, "/worktrees/") {
		t.Errorf("gitDir=%s commonDir=%s", info.GitDir, info.CommonDir)
	}
}

func TestOpenBare(t *testing.T) {
	r := gittest.New(t)
	r.Write("a", "a")
	r.Commit("one")
	bare := t.TempDir() + "/x.git"
	r.Git("clone", "-q", "--bare", r.Path, bare)
	info, err := Open(context.Background(), bare)
	if err != nil {
		t.Fatal(err)
	}
	if !info.Bare || info.Name != "x" || info.Head != r.H("one") || info.Branch != "main" {
		t.Errorf("%+v", info)
	}
}

func TestOpenNotARepo(t *testing.T) {
	_, err := Open(context.Background(), t.TempDir())
	if !errors.Is(err, gitcmd.ErrNotARepository) {
		t.Fatalf("got %v", err)
	}
}

func TestNameCommits(t *testing.T) {
	r := gittest.New(t)
	r.Write("a", "a")
	r.Commit("root")
	r.Branch("feature")
	r.Write("f", "f")
	r.Commit("f1")
	r.Checkout("main")
	r.Write("m", "m")
	r.Commit("m1")
	names, err := NameCommits(context.Background(), r.Path, []string{r.H("f1"), r.H("m1"), r.H("root"), "4b825dc642cb6eb9a060e54bf8d69288fbee4904"})
	if err != nil {
		t.Fatal(err)
	}
	if names[r.H("f1")] != "feature" || names[r.H("m1")] != "main" || names[r.H("root")] == "" {
		t.Errorf("%v", names)
	}
	if _, ok := names["4b825dc642cb6eb9a060e54bf8d69288fbee4904"]; ok {
		t.Error("unreachable object must not be named")
	}
	// A colleague's branch that was only fetched is still a branch.
	r.Write("p", "p")
	pr := r.Commit("pr1")
	r.Git("update-ref", "refs/remotes/origin/pr", pr)
	r.Git("reset", "-q", "--hard", "HEAD~1")
	names, err = NameCommits(context.Background(), r.Path, []string{pr})
	if err != nil || names[pr] != "pr" {
		t.Errorf("remote-only branch: %v %v", names, err)
	}
}

func TestDefaultBranchTip(t *testing.T) {
	refs := []Ref{{Full: "refs/remotes/origin/main", Hash: "o"}, {Full: "refs/heads/master", Hash: "m"}}
	if got := DefaultBranchTip(refs); got != "m" {
		t.Errorf("local master beats origin/main, got %q", got)
	}
	if got := DefaultBranchTip(refs[:1]); got != "o" {
		t.Errorf("origin/main as fallback, got %q", got)
	}
	if got := DefaultBranchTip(nil); got != "" {
		t.Errorf("no default branch, got %q", got)
	}
}
