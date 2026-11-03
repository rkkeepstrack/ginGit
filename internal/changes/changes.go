// Package changes turns a commit selection into one consolidated file list.
// It implements the two modes the spec insists on keeping apart: Range (one
// snapshot diff across a contiguous chain) and Aggregate (the union of each
// selected commit's own diff).
package changes

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"

	"ginGit/internal/gitcmd"
)

type Mode string

const (
	Range     Mode = "range"
	Aggregate Mode = "aggregate"
)

var ErrNotContiguous = errors.New("selection is not a contiguous first-parent chain")

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
	OldBlob   string `json:"oldBlob"`
	NewBlob   string `json:"newBlob"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
	Binary    bool   `json:"binary"`
}

type FileChange struct {
	Path      string  `json:"path"`
	OldPath   string  `json:"oldPath,omitempty"`
	Type      string  `json:"type"`
	Additions int     `json:"additions"`
	Deletions int     `json:"deletions"`
	Binary    bool    `json:"binary"`
	Touches   []Touch `json:"touches"` // newest first
	// Composable is true when each touch starts from the blob the previous
	// one produced, i.e. nothing outside the selection changed the file in
	// between. Then old(first)..new(last) is one honest patch.
	Composable bool `json:"composable"`
}

type ChangeSet struct {
	Mode   Mode     `json:"mode"`
	Hashes []string `json:"hashes"` // newest first
	// Contiguous reports whether Range mode is possible for this selection.
	Contiguous bool `json:"contiguous"`
	// RangeBase is the commit the range is diffed against (oldest^), or the
	// empty tree for a root commit.
	RangeBase string       `json:"rangeBase,omitempty"`
	Merges    []string     `json:"merges"`
	Files     []FileChange `json:"files"`
}

// Sort orders a selection newest first by history position.
func Sort(lk Lookup, hashes []string) ([]string, error) {
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

// IsChain reports whether hashes (newest first) are linked by first parents.
func IsChain(lk Lookup, hashes []string) bool {
	for i := 0; i+1 < len(hashes); i++ {
		p, ok := lk.Parents(hashes[i])
		if !ok || len(p) == 0 || p[0] != hashes[i+1] {
			return false
		}
	}
	return len(hashes) > 0
}

func firstParent(lk Lookup, hash string) string {
	p, ok := lk.Parents(hash)
	if !ok || len(p) == 0 {
		return gitcmd.EmptyTree
	}
	return p[0]
}

// Compute builds the change set. hashes may be in any order.
func Compute(ctx context.Context, root string, lk Lookup, hashes []string, mode Mode) (*ChangeSet, error) {
	if len(hashes) == 0 {
		return &ChangeSet{Mode: mode, Hashes: []string{}, Merges: []string{}, Files: []FileChange{}}, nil
	}
	for _, h := range hashes {
		if err := gitcmd.ValidateHash(h); err != nil {
			return nil, err
		}
	}
	sorted, err := Sort(lk, hashes)
	if err != nil {
		return nil, err
	}
	cs := &ChangeSet{Mode: mode, Hashes: sorted, Contiguous: IsChain(lk, sorted), Merges: []string{}}
	for _, h := range sorted {
		if p, _ := lk.Parents(h); len(p) > 1 {
			cs.Merges = append(cs.Merges, h)
		}
	}
	switch mode {
	case Range:
		if !cs.Contiguous {
			return nil, ErrNotContiguous
		}
		oldest := sorted[len(sorted)-1]
		cs.RangeBase = firstParent(lk, oldest)
		touches, err := diffTree(ctx, root, cs.RangeBase, sorted[0])
		if err != nil {
			return nil, err
		}
		// Range entries are a single pseudo-touch spanning the whole chain.
		for _, t := range touches {
			t.Commit = sorted[0]
			cs.Files = append(cs.Files, FileChange{
				Path: t.Path, OldPath: t.OldPath, Type: t.Type,
				Additions: t.Additions, Deletions: t.Deletions, Binary: t.Binary,
				Touches: []Touch{t}, Composable: true,
			})
		}
	case Aggregate:
		// Oldest first so renames can carry earlier touches forward.
		byPath := map[string]*FileChange{}
		var order []string
		for i := len(sorted) - 1; i >= 0; i-- {
			h := sorted[i]
			touches, err := diffTree(ctx, root, firstParent(lk, h), h)
			if err != nil {
				return nil, err
			}
			for _, t := range touches {
				t.Commit = h
				key := t.Path
				if t.OldPath != "" && t.OldPath != t.Path {
					if prev, ok := byPath[t.OldPath]; ok {
						delete(byPath, t.OldPath)
						byPath[key] = prev
						prev.Path = t.Path
					}
				}
				fc, ok := byPath[key]
				if !ok {
					fc = &FileChange{Path: t.Path}
					byPath[key] = fc
					order = append(order, key)
				}
				if t.OldPath != "" {
					if fc.OldPath == "" {
						fc.OldPath = t.OldPath
					}
				}
				fc.Additions += t.Additions
				fc.Deletions += t.Deletions
				fc.Binary = fc.Binary || t.Binary
				fc.Touches = append([]Touch{t}, fc.Touches...) // newest first
			}
		}
		// Renames may have moved entries; dedupe order by surviving pointers.
		seen := map[*FileChange]bool{}
		for _, fc := range byPath {
			if seen[fc] {
				continue
			}
			seen[fc] = true
			fc.Type = combinedType(fc.Touches)
			if fc.Type != "renamed" {
				fc.OldPath = ""
			}
			fc.Composable = composable(fc.Touches)
			cs.Files = append(cs.Files, *fc)
		}
	default:
		return nil, fmt.Errorf("%w: mode %q", gitcmd.ErrInvalidArg, mode)
	}
	sort.Slice(cs.Files, func(i, j int) bool { return cs.Files[i].Path < cs.Files[j].Path })
	if cs.Files == nil {
		cs.Files = []FileChange{}
	}
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

// diffTree runs one raw+numstat diff between two trees and merges both
// sections into touches, in git's output order.
func diffTree(ctx context.Context, root, from, to string) ([]Touch, error) {
	out, err := gitcmd.Run(ctx, root, "diff-tree", "-r", "-M", "-z", "--raw", "--numstat", from, to)
	if err != nil {
		return nil, err
	}
	return parseRawNumstat(string(out))
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
		if !ok || tok == "" && i >= len(tokens) {
			break
		}
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

func Key(root string, hashes []string, mode Mode) string {
	s := append([]string(nil), hashes...)
	sort.Strings(s)
	return root + "|" + string(mode) + "|" + strings.Join(s, ",")
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
