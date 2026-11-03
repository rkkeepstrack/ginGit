package search

import (
	"context"
	"testing"

	"ginGit/internal/gittest"
	"ginGit/internal/history"
)

func TestSearch(t *testing.T) {
	r := gittest.New(t)
	r.Write("a", "a")
	r.Commit("initial import")
	r.Branch("feature")
	r.Write("b", "b")
	r.Commit("add feature flag")
	r.Checkout("main")
	r.Write("c", "c")
	r.Commit("fix typo")
	ix := history.NewIndex()
	if _, err := history.Load(context.Background(), r.Path, history.Options{}, ix.Append); err != nil {
		t.Fatal(err)
	}
	br := NewBranches()
	hits, err := Run(context.Background(), r.Path, ix, br, Query{Text: "FEATURE"})
	if err != nil || len(hits) != 1 {
		t.Fatalf("text: %v %v", hits, err)
	}
	hits, _ = Run(context.Background(), r.Path, ix, br, Query{Text: r.H("fix typo")[:7]})
	if len(hits) != 1 {
		t.Errorf("hash prefix: %v", hits)
	}
	hits, _ = Run(context.Background(), r.Path, ix, br, Query{Branch: "refs/heads/main"})
	if len(hits) != 2 {
		t.Errorf("branch main should have 2 commits, got %v", hits)
	}
	hits, _ = Run(context.Background(), r.Path, ix, br, Query{Author: "nobody"})
	if len(hits) != 0 {
		t.Errorf("author: %v", hits)
	}
	if _, err := Run(context.Background(), r.Path, ix, br, Query{Branch: "--output=/tmp/x"}); err == nil {
		t.Error("option-looking branch must be rejected")
	}
}
