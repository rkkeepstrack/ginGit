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

func TestBranchCommits(t *testing.T) {
	// main: root, main1 | A (off root): a1 | B (off A): b1, b2
	r := gittest.New(t)
	r.Write("a", "a")
	r.Commit("root")
	r.Branch("A")
	r.Write("a1", "1")
	r.Commit("a1")
	r.Branch("B")
	r.Write("b1", "1")
	r.Commit("b1")
	r.Write("b2", "2")
	r.Commit("b2")
	r.Checkout("main")
	r.Write("m", "m")
	r.Commit("main1")
	// origin/B lags one commit behind B; it must not hide b2's sibling.
	r.Git("update-ref", "refs/remotes/origin/B", r.H("b1"))
	r.Git("update-ref", "refs/remotes/origin/main", r.H("main1"))

	want := map[string][]string{
		"refs/heads/B":    {r.H("b2"), r.H("b1")},
		"refs/heads/A":    {r.H("a1")},
		"refs/heads/main": {r.H("main1")},
	}
	for ref, hashes := range want {
		got, err := BranchCommits(context.Background(), r.Path, ref)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Join(got, ",") != strings.Join(hashes, ",") {
			t.Errorf("%s: got %v want %v", ref, got, hashes)
		}
	}
	if _, err := BranchCommits(context.Background(), r.Path, "--output=x"); err == nil {
		t.Error("option-looking ref must be rejected")
	}

	// Merging A into main must not turn A's own commits into A's whole ancestry.
	r.Merge("merge A", "A")
	got, err := BranchCommits(context.Background(), r.Path, "refs/heads/A")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(got, ",") != r.H("a1") {
		t.Errorf("merged A: got %v want [%s]", got, r.H("a1"))
	}
	got, _ = BranchCommits(context.Background(), r.Path, "refs/heads/main")
	if strings.Join(got, ",") != r.H("merge A")+","+r.H("main1") {
		t.Errorf("main after merge: got %v", got)
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
}
