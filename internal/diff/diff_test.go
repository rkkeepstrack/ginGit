package diff

import (
	"context"
	"strings"
	"testing"

	"ginGit/internal/changes"
	"ginGit/internal/gittest"
	"ginGit/internal/history"
)

func setup(t *testing.T) (*gittest.Repo, *history.Index) {
	r := gittest.New(t)
	r.Write("a.txt", "one\ntwo\n")
	r.Commit("c1")
	r.Write("a.txt", "one\ntwo\nthree\n")
	r.Commit("c2")
	r.Write("other.txt", "x\n")
	r.Write("a.txt", "one\ntwo\nthree\n3.5\n")
	r.Commit("c3")
	r.Write("a.txt", "one\ntwo\nthree\nfour\n")
	r.Commit("c4")
	ix := history.NewIndex()
	if _, err := history.Load(context.Background(), r.Path, history.Options{All: true}, ix.Append); err != nil {
		t.Fatal(err)
	}
	return r, ix
}

func subjects(ix *history.Index) Subjects {
	return func(h string) string {
		c, _ := ix.Get(h)
		return c.Subject
	}
}

func find(cs *changes.ChangeSet, path string) changes.FileChange {
	for _, f := range cs.Files {
		if f.Path == path {
			return f
		}
	}
	return changes.FileChange{}
}

func TestConsecutiveComposesIntoOnePair(t *testing.T) {
	r, ix := setup(t)
	cs, err := changes.Compute(context.Background(), r.Path, ix, []string{r.H("c2"), r.H("c3"), r.H("c4")}, changes.Aggregate)
	if err != nil {
		t.Fatal(err)
	}
	res, err := ForFile(context.Background(), r.Path, find(cs, "a.txt"), subjects(ix), NewCache(1<<20))
	if err != nil {
		t.Fatal(err)
	}
	if res.Stacked || len(res.Pairs) != 1 {
		t.Fatalf("%+v", res)
	}
	p := res.Pairs[0]
	if p.Old.Content != "one\ntwo\n" || p.New.Content != "one\ntwo\nthree\nfour\n" || p.Subject != "c4" {
		t.Errorf("%+v", p)
	}
}

func TestGapStacks(t *testing.T) {
	r, ix := setup(t)
	cs, _ := changes.Compute(context.Background(), r.Path, ix, []string{r.H("c2"), r.H("c4")}, changes.Aggregate)
	res, err := ForFile(context.Background(), r.Path, find(cs, "a.txt"), subjects(ix), NewCache(1<<20))
	if err != nil {
		t.Fatal(err)
	}
	if !res.Stacked || len(res.Pairs) != 2 || res.Note == "" {
		t.Fatalf("%+v", res)
	}
	if res.Pairs[0].Subject != "c4" || res.Pairs[1].Subject != "c2" {
		t.Errorf("order: %s, %s", res.Pairs[0].Subject, res.Pairs[1].Subject)
	}
	if res.Pairs[1].Old.Content != "one\ntwo\n" || res.Pairs[1].New.Content != "one\ntwo\nthree\n" {
		t.Errorf("c2 pair: %+v", res.Pairs[1])
	}
}

func TestAddedHasMissingOldSide(t *testing.T) {
	r, ix := setup(t)
	cs, _ := changes.Compute(context.Background(), r.Path, ix, []string{r.H("c3")}, changes.Aggregate)
	res, err := ForFile(context.Background(), r.Path, find(cs, "other.txt"), subjects(ix), NewCache(1<<20))
	if err != nil {
		t.Fatal(err)
	}
	if !res.Pairs[0].Old.Missing || res.Pairs[0].New.Content != "x\n" {
		t.Errorf("%+v", res.Pairs[0])
	}
}

func TestBinaryAndTooLarge(t *testing.T) {
	r := gittest.New(t)
	r.Write("bin", "a\x00b")
	r.Write("big.txt", strings.Repeat("x", MaxSide+1))
	r.Commit("c1")
	ix := history.NewIndex()
	history.Load(context.Background(), r.Path, history.Options{All: true}, ix.Append)
	cs, _ := changes.Compute(context.Background(), r.Path, ix, []string{r.H("c1")}, changes.Aggregate)
	cache := NewCache(1 << 20)
	bin, err := ForFile(context.Background(), r.Path, find(cs, "bin"), subjects(ix), cache)
	if err != nil || !bin.Pairs[0].New.Binary || bin.Pairs[0].New.Content != "" {
		t.Errorf("binary: %+v %v", bin, err)
	}
	big, err := ForFile(context.Background(), r.Path, find(cs, "big.txt"), subjects(ix), cache)
	if err != nil || !big.Pairs[0].New.TooLarge || big.Pairs[0].New.Content != "" {
		t.Errorf("too large: %+v %v", big, err)
	}
}
