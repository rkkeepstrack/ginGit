// Package changes turns a commit selection into one consolidated file list:
// the union of each selected commit's own diff against its first parent.
package changes

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"

	"ginGit/internal/gitcmd"
)

// Lookup is what we need from the loaded history.
type Lookup interface {
	Parents(hash string) ([]string, bool)
	Position(hash string) (int, bool)
}

// Touch is one commit's change to one file.
type Touch struct {
	Commit    string `json:"commit"`
	Type      string `json:"type"` // added, modified, deleted, renamed
	Path      string `json:"path"`
	OldPath   string `json:"oldPath,omitempty"`
	OldBlob   string `json:"-"`
	NewBlob   string `json:"-"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
	Binary    bool   `json:"binary"`
}

type FileChange struct {
	Path       string  `json:"path"`
	OldPath    string  `json:"oldPath,omitempty"`
	Type       string  `json:"type"`
	Additions  int     `json:"additions"`
	Deletions  int     `json:"deletions"`
	Binary     bool    `json:"binary"`
	Touches    []Touch `json:"-"` // newest first; FileDiff reads them, the UI only needs the count
	TouchCount int     `json:"touchCount"`
	// Composable is true when each touch starts from the blob the previous
	// one produced, i.e. nothing outside the selection changed the file in
	// between. Then old(first)..new(last) is one honest patch.
	Composable bool `json:"composable"`
}

type ChangeSet struct {
	Hashes []string     `json:"hashes"` // newest first
	Merges []string     `json:"merges"`
	Files  []FileChange `json:"files"`
}

// newestFirst orders a selection by history position.
func newestFirst(lk Lookup, hashes []string) ([]string, error) {
	out := append([]string(nil), hashes...)
	for _, h := range out {
		if _, ok := lk.Position(h); !ok {
			return nil, fmt.Errorf("%w: %s", gitcmd.ErrObjectNotFound, h)
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		pi, _ := lk.Position(out[i])
		pj, _ := lk.Position(out[j])
		return pi < pj
	})
	return out, nil
}

// Compute builds the change set. hashes may be in any order.
func Compute(ctx context.Context, root string, lk Lookup, hashes []string) (*ChangeSet, error) {
	if len(hashes) == 0 {
		return &ChangeSet{Hashes: []string{}, Merges: []string{}, Files: []FileChange{}}, nil
	}
	for _, h := range hashes {
		if err := gitcmd.ValidateHash(h); err != nil {
			return nil, err
		}
	}
	sorted, err := newestFirst(lk, hashes)
	if err != nil {
		return nil, err
	}
	cs := &ChangeSet{Hashes: sorted, Merges: []string{}, Files: []FileChange{}}
	for _, h := range sorted {
		if p, _ := lk.Parents(h); len(p) > 1 {
			cs.Merges = append(cs.Merges, h)
		}
	}
	perCommit, err := diffAll(ctx, root, sorted)
	if err != nil {
		return nil, err
	}
	// Oldest first so renames can carry earlier touches forward.
	byPath := map[string]*FileChange{}
	for i := len(sorted) - 1; i >= 0; i-- {
		h := sorted[i]
		for _, t := range perCommit[h] {
			t.Commit = h
			if t.OldPath != "" && t.OldPath != t.Path {
				if prev, ok := byPath[t.OldPath]; ok {
					delete(byPath, t.OldPath)
					byPath[t.Path] = prev
					prev.Path = t.Path
				}
			}
			fc, ok := byPath[t.Path]
			if !ok {
				fc = &FileChange{Path: t.Path}
				byPath[t.Path] = fc
			}
			if t.OldPath != "" && fc.OldPath == "" {
				fc.OldPath = t.OldPath
			}
			fc.Additions += t.Additions
			fc.Deletions += t.Deletions
			fc.Binary = fc.Binary || t.Binary
			fc.Touches = append([]Touch{t}, fc.Touches...) // newest first
		}
	}
	for _, fc := range byPath {
		fc.Type = combinedType(fc.Touches)
		if fc.Type != "renamed" {
			fc.OldPath = ""
		}
		fc.Composable = composable(fc.Touches)
		fc.TouchCount = len(fc.Touches)
		cs.Files = append(cs.Files, *fc)
	}
	sort.Slice(cs.Files, func(i, j int) bool { return cs.Files[i].Path < cs.Files[j].Path })
	return cs, nil
}

// composable checks blob continuity across touches (newest first).
func composable(touches []Touch) bool {
	for i := 0; i+1 < len(touches); i++ {
		newer, older := touches[i], touches[i+1]
		if newer.OldBlob != older.NewBlob {
			return false
		}
	}
	return true
}

// combinedType resolves what a sequence of touches (newest first) amounts to.
func combinedType(touches []Touch) string {
	newest, oldest := touches[0], touches[len(touches)-1]
	switch {
	case newest.Type == "deleted":
		return "deleted"
	case oldest.Type == "added":
		return "added"
	}
	for _, t := range touches {
		if t.Type == "renamed" {
			return "renamed"
		}
	}
	return "modified"
}

// diffAll fetches every commit's diff against its first parent in one git
// process: a thousand diff-tree spawns is what made big selections crawl.
// Each commit's record starts with RS, then its hash, then the same raw and
// numstat entries diff-tree would print.
func diffAll(ctx context.Context, root string, hashes []string) (map[string][]Touch, error) {
	args := []string{"log", "--no-walk=unsorted", "-m", "--first-parent", "--root", "-M", "--raw", "--numstat", "--no-abbrev", "-z", "--format=%x1e%H%x00"}
	out, err := gitcmd.Run(ctx, root, append(append(args, hashes...), "--")...)
	if err != nil {
		return nil, err
	}
	result := map[string][]Touch{}
	for _, rec := range strings.Split(string(out), "\x1e") {
		rec = strings.TrimLeft(rec, "\n")
		hash, rest, ok := strings.Cut(rec, "\x00")
		if !ok || len(hash) != 40 {
			continue
		}
		touches, err := parseRawNumstat(rest)
		if err != nil {
			return nil, err
		}
		result[hash] = touches
	}
	return result, nil
}

func parseRawNumstat(out string) ([]Touch, error) {
	tokens := strings.Split(out, "\x00")
	var touches []Touch
	byKey := map[string]int{}
	i := 0
	next := func() (string, bool) {
		if i >= len(tokens) {
			return "", false
		}
		t := tokens[i]
		i++
		return t, true
	}
	for {
		tok, ok := next()
		if !ok {
			break
		}
		// git log separates a commit header from its entries with a newline.
		tok = strings.TrimLeft(tok, "\n")
		if tok == "" {
			continue
		}
		if strings.HasPrefix(tok, ":") {
			// :oldmode newmode oldsha newsha STATUS
			f := strings.Fields(tok[1:])
			if len(f) != 5 {
				return nil, fmt.Errorf("unexpected raw entry %q", tok)
			}
			t := Touch{OldBlob: f[2], NewBlob: f[3]}
			status := f[4][0]
			switch status {
			case 'A':
				t.Type = "added"
			case 'D':
				t.Type = "deleted"
			case 'R':
				t.Type = "renamed"
			case 'C':
				t.Type = "added"
			default:
				t.Type = "modified"
			}
			if status == 'R' || status == 'C' {
				old, _ := next()
				nw, _ := next()
				t.OldPath, t.Path = old, nw
			} else {
				t.Path, _ = next()
			}
			touches = append(touches, t)
			byKey[t.OldPath+"\x00"+t.Path] = len(touches) - 1
			continue
		}
		// numstat: adds\tdels\tpath  or  adds\tdels\t  followed by old, new tokens
		parts := strings.SplitN(tok, "\t", 3)
		if len(parts) != 3 {
			return nil, fmt.Errorf("unexpected numstat entry %q", tok)
		}
		var oldPath, path string
		if parts[2] == "" {
			oldPath, _ = next()
			path, _ = next()
		} else {
			path = parts[2]
		}
		idx, ok := byKey[oldPath+"\x00"+path]
		if !ok {
			continue
		}
		t := &touches[idx]
		if parts[0] == "-" {
			t.Binary = true
			continue
		}
		t.Additions, _ = strconv.Atoi(parts[0])
		t.Deletions, _ = strconv.Atoi(parts[1])
	}
	return touches, nil
}

// Cache memoises change sets per repository. Cleared on refresh.
type Cache struct {
	mu   sync.Mutex
	data map[string]*ChangeSet
	max  int
}

func NewCache(max int) *Cache { return &Cache{data: map[string]*ChangeSet{}, max: max} }

func Key(hashes []string) string {
	s := append([]string(nil), hashes...)
	sort.Strings(s)
	return strings.Join(s, ",")
}

func (c *Cache) Get(k string) (*ChangeSet, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	v, ok := c.data[k]
	return v, ok
}

func (c *Cache) Put(k string, v *ChangeSet) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.data) >= c.max {
		c.data = map[string]*ChangeSet{}
	}
	c.data[k] = v
}

func (c *Cache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data = map[string]*ChangeSet{}
}
