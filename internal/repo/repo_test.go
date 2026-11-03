package repo

import (
	"context"
	"errors"
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
	r := gittest.New(t)
	r.Write("a", "a")
	r.Commit("root")
	r.Branch("feature")
	r.Write("f1", "1")
	r.Commit("f1")
	r.Write("f2", "2")
	r.Commit("f2")
	r.Checkout("main")
	r.Write("m", "m")
	r.Commit("main1")

	got, err := BranchCommits(context.Background(), r.Path, "refs/heads/feature")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0] != r.H("f2") || got[1] != r.H("f1") {
		t.Errorf("feature: %v", got)
	}
	got, err = BranchCommits(context.Background(), r.Path, "refs/heads/main")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0] != r.H("main1") {
		t.Errorf("main: %v", got)
	}
	if _, err := BranchCommits(context.Background(), r.Path, "--output=x"); err == nil {
		t.Error("option-looking ref must be rejected")
	}
}
