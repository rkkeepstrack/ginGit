package review

import (
	"path/filepath"
	"testing"

	"ginGit/internal/changes"
)

func TestMarks(t *testing.T) {
	s := &Store{dir: t.TempDir()}
	root := filepath.Join("/", "repo")
	if m, _ := s.Marks(root, "feature"); len(m) != 0 {
		t.Fatalf("fresh store must be empty, got %v", m)
	}
	if err := s.Set(root, "feature", "a.go", "abc"); err != nil {
		t.Fatal(err)
	}
	m, _ := s.Marks(root, "feature")
	if m["a.go"].Blob != "abc" || m["a.go"].At.IsZero() {
		t.Errorf("%+v", m)
	}
	if m, _ := s.Marks(root, "main"); len(m) != 0 {
		t.Errorf("branches must not share marks, got %v", m)
	}
	if err := s.Set(root, "feature", "a.go", ""); err != nil {
		t.Fatal(err)
	}
	if m, _ := s.Marks(root, "feature"); len(m) != 0 {
		t.Errorf("unset must forget, got %v", m)
	}
	if m, _ := s.Marks("/other", "feature"); len(m) != 0 {
		t.Errorf("repositories must not share marks, got %v", m)
	}
}

func TestAnnotate(t *testing.T) {
	cs := &changes.ChangeSet{Files: []changes.FileChange{
		{Path: "same.go", Touches: []changes.Touch{{NewBlob: "b1"}}},
		{Path: "moved.go", Touches: []changes.Touch{{NewBlob: "b3"}, {NewBlob: "b2"}}},
		{Path: "new.go", Touches: []changes.Touch{{NewBlob: "b4"}}},
	}}
	marks := map[string]Mark{"same.go": {Blob: "b1"}, "moved.go": {Blob: "b2"}}
	out := Annotate(cs, "feature", marks)
	if !out.Reviewable {
		t.Fatal("a branch makes the set reviewable")
	}
	want := map[string]string{"same.go": "reviewed", "moved.go": "stale", "new.go": ""}
	for _, fc := range out.Files {
		if fc.Review != want[fc.Path] {
			t.Errorf("%s: got %q, want %q", fc.Path, fc.Review, want[fc.Path])
		}
		if fc.Path == "moved.go" && fc.ReviewedBlob != "b2" {
			t.Errorf("stale file keeps the reviewed blob, got %q", fc.ReviewedBlob)
		}
	}
	if cs.Files[0].Review != "" {
		t.Error("the cached change set must stay untouched")
	}
	if out := Annotate(cs, "", nil); out.Reviewable {
		t.Error("no branch, nothing to review")
	}
}
