package history

import "sync"

// Index is the in-memory history the app keeps after a load. Search and
// aggregation read parents and positions from it instead of asking git again.
type Index struct {
	mu      sync.RWMutex
	commits []Commit
	pos     map[string]int
}

func NewIndex() *Index { return &Index{pos: map[string]int{}} }

func (ix *Index) Append(cs []Commit) {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	for _, c := range cs {
		ix.pos[c.Hash] = len(ix.commits)
		ix.commits = append(ix.commits, c)
	}
}

// Position is the row index, 0 being the newest commit.
func (ix *Index) Position(hash string) (int, bool) {
	ix.mu.RLock()
	defer ix.mu.RUnlock()
	p, ok := ix.pos[hash]
	return p, ok
}

func (ix *Index) Parents(hash string) ([]string, bool) {
	ix.mu.RLock()
	defer ix.mu.RUnlock()
	p, ok := ix.pos[hash]
	if !ok {
		return nil, false
	}
	return ix.commits[p].Parents, true
}

func (ix *Index) Get(hash string) (Commit, bool) {
	ix.mu.RLock()
	defer ix.mu.RUnlock()
	p, ok := ix.pos[hash]
	if !ok {
		return Commit{}, false
	}
	return ix.commits[p], true
}

// Each calls fn for every commit in order until fn returns false.
func (ix *Index) Each(fn func(i int, c *Commit) bool) {
	ix.mu.RLock()
	defer ix.mu.RUnlock()
	for i := range ix.commits {
		if !fn(i, &ix.commits[i]) {
			return
		}
	}
}

// Reaches reports whether target is an ancestor of (or equal to) from. Topo
// order lets the walk stop at commits older than the target.
func (ix *Index) Reaches(from, target string) bool {
	ix.mu.RLock()
	defer ix.mu.RUnlock()
	start, ok := ix.pos[from]
	tpos, ok2 := ix.pos[target]
	if !ok || !ok2 {
		return false
	}
	seen := make([]bool, len(ix.commits))
	stack := []int{start}
	for len(stack) > 0 {
		p := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		if p == tpos {
			return true
		}
		if p > tpos || seen[p] {
			continue
		}
		seen[p] = true
		for _, h := range ix.commits[p].Parents {
			if q, ok := ix.pos[h]; ok {
				stack = append(stack, q)
			}
		}
	}
	return false
}
