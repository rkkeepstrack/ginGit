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
	r.Write("b", "b")
	r.Commit("add feature flag")
	r.Write("c", "c")
	r.Commit("fix typo")
	ix := history.NewIndex()
	if _, err := history.Load(context.Background(), r.Path, history.Options{}, ix.Append); err != nil {
		t.Fatal(err)
	}
	if hits := Run(ix, "FEATURE"); len(hits) != 1 {
		t.Fatalf("text: %v", hits)
	}
	if hits := Run(ix, r.H("fix typo")[:7]); len(hits) != 1 || hits[0] != 0 {
		t.Fatalf("hash prefix: %v", hits)
	}
	if hits := Run(ix, "  "); len(hits) != 3 {
		t.Fatalf("blank matches everything: %v", hits)
	}
	if hits := Run(ix, "nobody"); len(hits) != 0 {
		t.Fatalf("no match: %v", hits)
	}
}
