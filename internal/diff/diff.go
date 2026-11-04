// Package diff fetches the two sides of a file change so the frontend can
// render them. The diff itself is computed by CodeMirror; what we guarantee
// here is that the sides are the right blobs, and that we never ship a binary
// or a monster.
package diff

import (
	"bytes"
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"

	"ginGit/internal/changes"
	"ginGit/internal/gitcmd"
)

// MaxSide caps each side of a diff.
const MaxSide = 2 * 1024 * 1024

const zeroBlob = "0000000000000000000000000000000000000000"

type Side struct {
	Blob     string `json:"blob"`
	Path     string `json:"path"`
	Content  string `json:"content"`
	Size     int    `json:"size"`
	Missing  bool   `json:"missing"` // added (old side) or deleted (new side)
	Binary   bool   `json:"binary"`
	TooLarge bool   `json:"tooLarge"`
}

// Pair is one renderable old/new comparison.
type Pair struct {
	Commit string `json:"commit"` // the commit that produced the new side
	Type   string `json:"type"`
	Old    Side   `json:"old"`
	New    Side   `json:"new"`
}

type Result struct {
	Path string `json:"path"`
	Type string `json:"type"`
	// Stacked is true when the pairs cannot be composed into one patch and
	// the UI must show them one after the other.
	Stacked bool   `json:"stacked"`
	Note    string `json:"note,omitempty"`
	Pairs   []Pair `json:"pairs"`
}

// ForFile builds the diff for one entry of a change set.
func ForFile(ctx context.Context, root string, fc changes.FileChange, cache *Cache) (*Result, error) {
	if len(fc.Touches) == 0 {
		return nil, fmt.Errorf("%w: no touches for %s", gitcmd.ErrInvalidArg, fc.Path)
	}
	res := &Result{Path: fc.Path, Type: fc.Type}
	newest, oldest := fc.Touches[0], fc.Touches[len(fc.Touches)-1]
	if fc.Composable && isZero(oldest.OldBlob) && isZero(newest.NewBlob) && len(fc.Touches) > 1 {
		// Added and deleted again within the selection: the composed patch is
		// nothing to nothing. Show what came and went instead.
		res.Stacked = true
		res.Note = "This file was added and deleted again within the selection, so there is no net change. Each commit's own change is shown below."
		return stacked(ctx, root, fc, cache, res)
	}
	if fc.Composable {
		// Old side of the oldest touch, new side of the newest: one honest patch.
		p, err := pair(ctx, root, cache, oldest, newest)
		if err != nil {
			return nil, err
		}
		p.Type = fc.Type
		res.Pairs = []Pair{p}
		return res, nil
	}
	res.Stacked = true
	res.Note = "Commits outside the selection also changed this file in between, so the selected changes can't be merged into one patch. Each commit's own change is shown below."
	return stacked(ctx, root, fc, cache, res)
}

func isZero(blob string) bool { return blob == zeroBlob || blob == "" }

// stacked fills res with one pair per touch, newest first.
func stacked(ctx context.Context, root string, fc changes.FileChange, cache *Cache, res *Result) (*Result, error) {
	// All blobs in one round, not two spawns per touch.
	var wanted []string
	for _, t := range fc.Touches {
		wanted = append(wanted, t.OldBlob, t.NewBlob)
	}
	if _, err := fetch(ctx, root, cache, wanted...); err != nil {
		return nil, err
	}
	for _, t := range fc.Touches {
		p, err := pair(ctx, root, cache, t, t)
		if err != nil {
			return nil, err
		}
		res.Pairs = append(res.Pairs, p)
	}
	return res, nil
}

// ForFiles is ForFile for a batch: every blob of every file is fetched in
// one cat-file round, then the results are assembled from the cache.
func ForFiles(ctx context.Context, root string, files []changes.FileChange, cache *Cache) (map[string]*Result, error) {
	var wanted []string
	for _, fc := range files {
		for _, t := range fc.Touches {
			wanted = append(wanted, t.OldBlob, t.NewBlob)
		}
	}
	if _, err := fetch(ctx, root, cache, wanted...); err != nil {
		return nil, err
	}
	out := make(map[string]*Result, len(files))
	for _, fc := range files {
		res, err := ForFile(ctx, root, fc, cache)
		if err != nil {
			return nil, err
		}
		out[fc.Path] = res
	}
	return out, nil
}

// pair compares from's old side with to's new side.
func pair(ctx context.Context, root string, cache *Cache, from, to changes.Touch) (Pair, error) {
	blobs, err := fetch(ctx, root, cache, from.OldBlob, to.NewBlob)
	if err != nil {
		return Pair{}, err
	}
	p := Pair{Commit: to.Commit, Type: to.Type, Old: blobs[from.OldBlob], New: blobs[to.NewBlob]}
	p.Old.Path, p.New.Path = from.OldPath, to.Path
	if p.Old.Path == "" {
		p.Old.Path = from.Path
	}
	return p, nil
}

// fetch loads blobs (deduplicated, cached) through one cat-file --batch call.
func fetch(ctx context.Context, root string, cache *Cache, hashes ...string) (map[string]Side, error) {
	out := map[string]Side{}
	var need []string
	for _, h := range hashes {
		if h == zeroBlob || h == "" {
			out[h] = Side{Blob: h, Missing: true}
			continue
		}
		if err := gitcmd.ValidateHash(h); err != nil {
			return nil, err
		}
		if s, ok := cache.Get(h); ok {
			out[h] = s
			continue
		}
		need = append(need, h)
	}
	if len(need) == 0 {
		return out, nil
	}
	// Sizes first, so a 500 MB blob never crosses the pipe.
	sizes, err := gitcmd.RunInput(ctx, root, []byte(strings.Join(need, "\n")+"\n"), "cat-file", "--batch-check")
	if err != nil {
		return nil, err
	}
	var want []string
	for _, line := range strings.Split(strings.TrimSpace(string(sizes)), "\n") {
		f := strings.Fields(line)
		if len(f) < 3 || f[1] != "blob" {
			if len(f) >= 2 && f[1] == "missing" {
				return nil, fmt.Errorf("%w: blob %s", gitcmd.ErrObjectNotFound, f[0])
			}
			// commit objects (submodules) and the like: show nothing
			if len(f) >= 1 {
				out[f[0]] = Side{Blob: f[0], Missing: true}
			}
			continue
		}
		size, _ := strconv.Atoi(f[2])
		if size > MaxSide {
			s := Side{Blob: f[0], Size: size, TooLarge: true}
			cache.Put(f[0], s)
			out[f[0]] = s
			continue
		}
		want = append(want, f[0])
	}
	if len(want) == 0 {
		return out, nil
	}
	data, err := gitcmd.RunInput(ctx, root, []byte(strings.Join(want, "\n")+"\n"), "cat-file", "--batch")
	if err != nil {
		return nil, err
	}
	for len(data) > 0 {
		nl := bytes.IndexByte(data, '\n')
		if nl < 0 {
			break
		}
		header := strings.Fields(string(data[:nl]))
		data = data[nl+1:]
		if len(header) < 3 {
			break
		}
		size, _ := strconv.Atoi(header[2])
		if size > len(data) {
			size = len(data)
		}
		content := data[:size]
		data = data[size:]
		if len(data) > 0 && data[0] == '\n' {
			data = data[1:]
		}
		s := Side{Blob: header[0], Size: size}
		if isBinary(content) {
			s.Binary = true
		} else {
			s.Content = string(content)
		}
		cache.Put(header[0], s)
		out[header[0]] = s
	}
	return out, nil
}

func isBinary(b []byte) bool {
	probe := b
	if len(probe) > 8000 {
		probe = probe[:8000]
	}
	return bytes.IndexByte(probe, 0) >= 0
}

// Cache holds blob contents keyed by hash. Blobs are immutable, so the only
// eviction policy needed is "don't eat all the memory".
type Cache struct {
	mu    sync.Mutex
	data  map[string]Side
	bytes int
	max   int
}

func NewCache(maxBytes int) *Cache { return &Cache{data: map[string]Side{}, max: maxBytes} }

func (c *Cache) Get(h string) (Side, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	s, ok := c.data[h]
	return s, ok
}

func (c *Cache) Put(h string, s Side) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.bytes+len(s.Content) > c.max {
		c.data = map[string]Side{}
		c.bytes = 0
	}
	c.data[h] = s
	c.bytes += len(s.Content)
}

func (c *Cache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data = map[string]Side{}
	c.bytes = 0
}

// CountMatches counts case-insensitive occurrences of needle in the diff of
// each file: the new side of every pair, or the old side where the file
// was deleted. Files without a match are left out.
func CountMatches(ctx context.Context, root string, files []changes.FileChange, cache *Cache, needle string) (map[string]int, error) {
	needle = strings.ToLower(needle)
	if needle == "" {
		return map[string]int{}, nil
	}
	results, err := ForFiles(ctx, root, files, cache)
	if err != nil {
		return nil, err
	}
	counts := map[string]int{}
	for path, res := range results {
		n := 0
		for _, p := range res.Pairs {
			side := p.New
			if side.Missing {
				side = p.Old
			}
			n += strings.Count(strings.ToLower(side.Content), needle)
		}
		if n > 0 {
			counts[path] = n
		}
	}
	return counts, nil
}
