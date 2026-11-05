// Package review remembers which file versions the user has looked at. A mark
// is "I have seen this path at this blob, while reviewing this branch"; it
// lives in the user's config dir, never in the repository, one file per
// repository with the marks grouped by branch.
package review

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Mark struct {
	Blob string    `json:"blob"`
	At   time.Time `json:"at"`
}

type Store struct {
	dir string
	mu  sync.Mutex
}

func NewStore() (*Store, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	dir := filepath.Join(base, "ginGit", "reviewed")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Store{dir: dir}, nil
}

func (s *Store) file(root string) string {
	sum := sha1.Sum([]byte(root))
	return filepath.Join(s.dir, hex.EncodeToString(sum[:])+".json")
}

// marks on disk: branch → path → mark
type file map[string]map[string]Mark

func (s *Store) load(root string) (file, error) {
	data, err := os.ReadFile(s.file(root))
	if errors.Is(err, os.ErrNotExist) {
		return file{}, nil
	}
	if err != nil {
		return nil, err
	}
	f := file{}
	if err := json.Unmarshal(data, &f); err != nil {
		return file{}, nil // a corrupt file forgets, it never blocks
	}
	return f, nil
}

func (s *Store) save(root string, f file) error {
	data, err := json.MarshalIndent(f, "", " ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.file(root), data, 0o644)
}

// Marks returns the marks made while reviewing a branch, keyed by path.
func (s *Store) Marks(root, branch string) (map[string]Mark, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	f, err := s.load(root)
	if err != nil {
		return nil, err
	}
	marks := f[branch]
	if marks == nil {
		marks = map[string]Mark{}
	}
	return marks, nil
}

// Set records that path was seen at blob while reviewing branch; an empty
// blob forgets the mark.
func (s *Store) Set(root, branch, path, blob string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	f, err := s.load(root)
	if err != nil {
		return err
	}
	if f[branch] == nil {
		f[branch] = map[string]Mark{}
	}
	if blob == "" {
		delete(f[branch], path)
		if len(f[branch]) == 0 {
			delete(f, branch)
		}
	} else {
		f[branch][path] = Mark{Blob: blob, At: time.Now()}
	}
	return s.save(root, f)
}
