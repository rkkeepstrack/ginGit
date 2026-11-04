package history

import (
	"context"
	"strings"
	"testing"

	"ginGit/internal/gittest"
	"ginGit/internal/repo"
)

func tips(r *gittest.Repo, t *testing.T) []repo.Ref {
	t.Helper()
	refs, err := repo.Refs(context.Background(), r.Path)
	if err != nil {
		t.Fatal(err)
	}
	return refs
}

func TestBranchCommitsOverIndex(t *testing.T) {
	// main: root, main1 | A (off root): a1 | B (off A): b1, b2 | then A merged into main
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
	r.Git("update-ref", "refs/remotes/origin/B", r.H("b1")) // lagging remote of B
	r.Git("tag", "v1")
	r.Merge("merge A", "A")

	ix := NewIndex()
	if _, err := Load(context.Background(), r.Path, Options{}, ix.Append); err != nil {
		t.Fatal(err)
	}
	refs := tips(r, t)
	want := map[string][]string{
		"refs/heads/B":    {r.H("b2"), r.H("b1")},
		"refs/heads/A":    {r.H("a1")},
		"refs/heads/main": {r.H("merge A"), r.H("main1")},
	}
	for ref, hashes := range want {
		got, ok := ix.BranchCommits(refs, ref)
		if !ok {
			t.Fatalf("%s: tip not indexed", ref)
		}
		if strings.Join(got, ",") != strings.Join(hashes, ",") {
			t.Errorf("%s: got %v want %v", ref, got, hashes)
		}
	}
	if _, ok := ix.BranchCommits(refs, "refs/heads/nope"); ok {
		t.Error("unknown ref must report not ok")
	}
}

// Raphael's shape: main is a chain of merged pull requests whose branches are
// gone, and a stack of feature branches sits on top of main. The stack must
// not inherit the merged pull requests.
func TestBranchCommitsStackOnMergedMain(t *testing.T) {
	r := gittest.New(t)
	r.Write("a", "a")
	r.Commit("root")
	r.Branch("pr-1")
	r.Write("p1", "1")
	r.Commit("p1")
	r.Checkout("main")
	r.Merge("Merge pull request #1", "pr-1")
	r.Git("branch", "-D", "pr-1")
	r.Branch("pr-2")
	r.Write("p2", "2")
	r.Commit("p2")
	r.Checkout("main")
	r.Merge("Merge pull request #2", "pr-2")
	r.Git("branch", "-D", "pr-2")
	r.Branch("redis")
	r.Write("r1", "1")
	r.Commit("r1")
	r.Branch("bullmq")
	r.Write("q1", "1")
	r.Commit("q1")
	r.Checkout("main")

	ix := NewIndex()
	if _, err := Load(context.Background(), r.Path, Options{}, ix.Append); err != nil {
		t.Fatal(err)
	}
	refs := tips(r, t)
	want := map[string][]string{
		"refs/heads/bullmq": {r.H("q1")},
		"refs/heads/redis":  {r.H("r1")},
		"refs/heads/main":   {r.H("Merge pull request #2"), r.H("p2"), r.H("Merge pull request #1"), r.H("p1"), r.H("root")},
	}
	for ref, hashes := range want {
		got, _ := ix.BranchCommits(refs, ref)
		if strings.Join(got, ",") != strings.Join(hashes, ",") {
			t.Errorf("%s: got %d %v want %v", ref, len(got), got, hashes)
		}
	}
}

func TestReaches(t *testing.T) {
	r := gittest.New(t)
	r.Write("a", "a")
	r.Commit("root")
	r.Branch("feature")
	r.Write("f", "f")
	r.Commit("f1")
	r.Checkout("main")
	r.Write("m", "m")
	r.Commit("m1")
	ix := NewIndex()
	if _, err := Load(context.Background(), r.Path, Options{}, ix.Append); err != nil {
		t.Fatal(err)
	}
	if !ix.Reaches(r.H("m1"), r.H("root")) || ix.Reaches(r.H("m1"), r.H("f1")) || !ix.Reaches(r.H("f1"), r.H("f1")) {
		t.Error("reachability wrong")
	}
	r.Merge("merge", "feature")
	ix = NewIndex()
	Load(context.Background(), r.Path, Options{}, ix.Append)
	if !ix.Reaches(r.H("merge"), r.H("f1")) {
		t.Error("merged feature must be reachable from main")
	}
}
