package review

import (
	"path/filepath"
	"testing"
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
