package history

import (
	"context"
	"testing"

	"ginGit/internal/gittest"
)

func TestLoadStreamsInTopoOrderWithLanes(t *testing.T) {
	r := gittest.New(t)
	r.Write("a.txt", "a\n")
	r.Commit("root")
	r.Branch("feature")
	r.Write("f.txt", "f\n")
	r.Commit("feat")
	r.Checkout("main")
	r.Write("b.txt", "b\n")
	r.Commit("main2")
	r.Merge("merge", "feature")

	var got []Commit
	total, err := Load(context.Background(), r.Path, Options{ChunkSize: 2}, func(c []Commit) {
		got = append(got, c...)
	})
	if err != nil {
		t.Fatal(err)
	}
	if total != 4 || len(got) != 4 {
		t.Fatalf("total=%d len=%d", total, len(got))
	}
	if got[0].Hash != r.H("merge") || len(got[0].Parents) != 2 {
		t.Fatalf("first commit should be the merge with two parents: %+v", got[0])
	}
	if got[0].Parents[0] != r.H("main2") {
		t.Errorf("first parent should be main2")
	}
	if got[3].Hash != r.H("root") || len(got[3].Parents) != 0 {
		t.Errorf("last should be root with no parents: %+v", got[3])
	}
	if got[0].Row.Lanes != 2 {
		t.Errorf("merge row should span 2 lanes, got %d", got[0].Row.Lanes)
	}
	if got[0].Subject != "merge" || got[0].Author != "Test" {
		t.Errorf("metadata: %+v", got[0])
	}
}

func TestLoadCancel(t *testing.T) {
	r := gittest.New(t)
	for i := 0; i < 5; i++ {
		r.Write("a.txt", string(rune('a'+i)))
		r.Commit("c")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := Load(ctx, r.Path, Options{}, func([]Commit) {})
	if err == nil {
		t.Fatal("expected cancellation error")
	}
}
