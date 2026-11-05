// Package review remembers which file versions the user has looked at. A mark
// is "I have seen this path at this blob"; it lives in the user's config dir,
// never in the repository, one file per repository.
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

func (s *Store) load(root string) (map[string]Mark, error) {
	data, err := os.ReadFile(s.file(root))
	if errors.Is(err, os.ErrNotExist) {
		return map[string]Mark{}, nil
	}
	if err != nil {
		return nil, err
	}
	marks := map[string]Mark{}
	if err := json.Unmarshal(data, &marks); err != nil {
		return map[string]Mark{}, nil // a corrupt file forgets, it never blocks
	}
	return marks, nil
}

func (s *Store) save(root string, marks map[string]Mark) error {
	data, err := json.MarshalIndent(marks, "", " ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.file(root), data, 0o644)
}

// Marks returns every mark for a repository, keyed by path.
func (s *Store) Marks(root string) (map[string]Mark, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.load(root)
}

// Set records that path was seen at blob; an empty blob forgets the mark.
func (s *Store) Set(root, path, blob string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	marks, err := s.load(root)
	if err != nil {
		return err
	}
	if blob == "" {
		delete(marks, path)
	} else {
		marks[path] = Mark{Blob: blob, At: time.Now()}
	}
	return s.save(root, marks)
}
