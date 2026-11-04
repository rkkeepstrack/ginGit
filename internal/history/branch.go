package history

import (
	"sort"
	"strings"

	"ginGit/internal/repo"
)

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

// BranchCommits is the branch's own work, newest first.
//
// For every other branch, the newest commit of its first-parent line that
// the ref can reach is where the two meet; everything reachable from there
// belongs to that other branch and is subtracted. Only first-parent lines
// count as meeting points, so a branch merged into main still owns its
// commits (main reaches them, but its first-parent line never passes through
// them). Subtracting full reachability from the meeting point is what keeps
// pull requests merged into main, whose branches are long deleted, from
// being claimed by a branch stacked on top of main.
//
// A branch stacked on top of ref carries ref's tip on its own first-parent
// line and is left out, so the base of a stack keeps its commits. Ref's own
// remote counterparts are left out too, or a lagging origin/x would hide the
// pushed ones. Returns ok=false when the ref's tip is not in the index yet.
func (ix *Index) BranchCommits(refs []repo.Ref, ref string) (hashes []string, ok bool) {
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
	firstParent := func(p int) (int, bool) {
		parents := ix.commits[p].Parents
		if len(parents) == 0 {
			return 0, false
		}
		q, ok := ix.pos[parents[0]]
		return q, ok
	}
	// Topo order puts children before parents: once a first-parent walk is
	// past the tip's position it can no longer reach the tip.
	stackedOn := func(p int) bool {
		for {
			if p == tipPos {
				return true
			}
			if p > tipPos {
				return false
			}
			next, ok := firstParent(p)
			if !ok {
				return false
			}
			p = next
		}
	}
	// Everything the ref reaches.
	reach := make([]bool, len(ix.commits))
	ix.walk(tipPos, reach, len(ix.commits))
	// Everything that belongs to another branch, from each meeting point down.
	cut := make([]bool, len(ix.commits))
	for _, r := range refs {
		if r.Kind == "tag" || r.Full == ref || shortName(r.Full) == shortName(ref) {
			continue
		}
		p, ok := ix.pos[r.Hash]
		if !ok || stackedOn(p) {
			continue
		}
		for {
			if reach[p] {
				ix.walk(p, cut, len(ix.commits))
				break
			}
			next, ok := firstParent(p)
			if !ok {
				break
			}
			p = next
		}
	}
	var own []int
	for p := range reach {
		if reach[p] && !cut[p] {
			own = append(own, p)
		}
	}
	sort.Ints(own)
	hashes = make([]string, len(own))
	for i, p := range own {
		hashes[i] = ix.commits[p].Hash
	}
	return hashes, true
}

// walk marks every commit reachable from p, stopping at ones already marked
// and at positions past until: topo order puts parents after children, so
// nothing beyond can lead back to a commit at until.
func (ix *Index) walk(p int, seen []bool, until int) {
	stack := []int{p}
	for len(stack) > 0 {
		p := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		if seen[p] || p > until {
			continue
		}
		seen[p] = true
		for _, h := range ix.commits[p].Parents {
			if q, ok := ix.pos[h]; ok && !seen[q] {
				stack = append(stack, q)
			}
		}
	}
}
