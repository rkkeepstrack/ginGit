// Package search filters the in-memory history. No git involved except for
// branch membership, which is resolved once per branch and cached.
package search

import (
	"context"
	"strings"
	"sync"
	"time"

	"ginGit/internal/gitcmd"
	"ginGit/internal/history"
)

type Query struct {
	Text   string    `json:"text"`   // matches subject, body, author, hash prefix
	Author string    `json:"author"` // substring, case-insensitive
	Branch string    `json:"branch"` // full ref name, e.g. refs/heads/main
	Since  time.Time `json:"since"`
	Until  time.Time `json:"until"`
}

// Branches caches which commits belong to which branch.
type Branches struct {
	mu   sync.Mutex
	sets map[string]map[string]bool
}

func NewBranches() *Branches { return &Branches{sets: map[string]map[string]bool{}} }

func (b *Branches) Clear() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.sets = map[string]map[string]bool{}
}

func (b *Branches) members(ctx context.Context, root, ref string) (map[string]bool, error) {
	b.mu.Lock()
	if s, ok := b.sets[ref]; ok {
		b.mu.Unlock()
		return s, nil
	}
	b.mu.Unlock()
	if !strings.HasPrefix(ref, "refs/") || strings.Contains(ref, "..") || strings.HasPrefix(ref, "-") {
		return nil, gitcmd.ErrInvalidArg
	}
	out, err := gitcmd.Run(ctx, root, "rev-list", ref, "--")
	if err != nil {
		return nil, err
	}
	set := map[string]bool{}
	for _, h := range strings.Fields(string(out)) {
		set[h] = true
	}
	b.mu.Lock()
	b.sets[ref] = set
	b.mu.Unlock()
	return set, nil
}

// Run returns the positions of matching commits, in history order.
func Run(ctx context.Context, root string, ix *history.Index, br *Branches, q Query) ([]int, error) {
	var inBranch map[string]bool
	if q.Branch != "" {
		var err error
		inBranch, err = br.members(ctx, root, q.Branch)
		if err != nil {
			return nil, err
		}
	}
	text := strings.ToLower(strings.TrimSpace(q.Text))
	author := strings.ToLower(strings.TrimSpace(q.Author))
	var hits []int
	ix.Each(func(i int, c *history.Commit) bool {
		if inBranch != nil && !inBranch[c.Hash] {
			return true
		}
		if !q.Since.IsZero() && c.AuthorDate.Before(q.Since) {
			return true
		}
		if !q.Until.IsZero() && c.AuthorDate.After(q.Until) {
			return true
		}
		if author != "" && !strings.Contains(strings.ToLower(c.Author), author) && !strings.Contains(strings.ToLower(c.AuthorEmail), author) {
			return true
		}
		if text != "" {
			if !(strings.HasPrefix(c.Hash, text) ||
				strings.Contains(strings.ToLower(c.Subject), text) ||
				strings.Contains(strings.ToLower(c.Body), text) ||
				strings.Contains(strings.ToLower(c.Author), text)) {
				return true
			}
		}
		hits = append(hits, i)
		return true
	})
	if hits == nil {
		hits = []int{}
	}
	return hits, nil
}
