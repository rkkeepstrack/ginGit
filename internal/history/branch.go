package history

import (
	"sort"
	"strings"
)

// RefTip is what BranchCommits needs to know about a ref.
type RefTip struct {
	Full string
	Hash string
	Tag  bool
}

// shortName strips refs/heads/ or refs/remotes/<remote>/ so a branch and its
// remote-tracking counterparts compare equal.
func shortName(full string) string {
	if strings.HasPrefix(full, "refs/heads/") {
		return strings.TrimPrefix(full, "refs/heads/")
	}
	if rest, ok := strings.CutPrefix(full, "refs/remotes/"); ok {
		if _, name, ok := strings.Cut(rest, "/"); ok {
			return name
		}
	}
	return full
}

// BranchCommits is the branch's own work, newest first: the commits reachable
// from ref that sit on no unrelated branch's first-parent line. It runs over
// the loaded index, no git involved, because the git version spawned one
// rev-list per descendant branch and took a second on old branches.
//
// A branch stacked on top of ref carries ref's tip on its first-parent line
// and is left out of the comparison, so the base of a stack keeps its
// commits. Ref's own remote counterparts are left out too, or a lagging
// origin/x would hide the pushed ones. Returns ok=false when the ref's tip is
// not in the index (history still loading).
func (ix *Index) BranchCommits(refs []RefTip, ref string) (hashes []string, ok bool) {
	ix.mu.RLock()
	defer ix.mu.RUnlock()
	var tip string
	for _, r := range refs {
		if r.Full == ref {
			tip = r.Hash
		}
	}
	tipPos, known := ix.pos[tip]
	if !known {
		return nil, false
	}
	firstParent := func(h string) (string, bool) {
		p, ok := ix.pos[h]
		if !ok || len(ix.commits[p].Parents) == 0 {
			return "", false
		}
		return ix.commits[p].Parents[0], true
	}
	// Topo order puts children before parents: once a first-parent walk passes
	// the tip's position it can no longer reach the tip.
	stackedOn := func(h string) bool {
		for h != "" {
			if h == tip {
				return true
			}
			if p, ok := ix.pos[h]; !ok || p > tipPos {
				return false
			}
			next, ok := firstParent(h)
			if !ok {
				return false
			}
			h = next
		}
		return false
	}
	taken := make([]bool, len(ix.commits))
	for _, r := range refs {
		if r.Tag || r.Full == ref || shortName(r.Full) == shortName(ref) || stackedOn(r.Hash) {
			continue
		}
		for h := r.Hash; h != ""; {
			p, ok := ix.pos[h]
			if !ok || taken[p] {
				break
			}
			taken[p] = true
			h, _ = firstParent(h)
		}
	}
	seen := make([]bool, len(ix.commits))
	var own []int
	stack := []string{tip}
	for len(stack) > 0 {
		h := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		p, ok := ix.pos[h]
		if !ok || seen[p] {
			continue
		}
		seen[p] = true
		if !taken[p] {
			own = append(own, p)
		}
		stack = append(stack, ix.commits[p].Parents...)
	}
	sort.Ints(own)
	hashes = make([]string, len(own))
	for i, p := range own {
		hashes[i] = ix.commits[p].Hash
	}
	return hashes, true
}
