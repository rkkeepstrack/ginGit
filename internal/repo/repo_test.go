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
}
