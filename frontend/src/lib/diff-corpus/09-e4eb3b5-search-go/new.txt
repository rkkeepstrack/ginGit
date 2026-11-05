// Package search filters the in-memory history; no git involved.
package search

import (
	"strings"

	"ginGit/internal/history"
)

// Run returns the positions of commits whose hash prefix, subject, body or
// author contains text, in history order.
func Run(ix *history.Index, text string) []int {
	text = strings.ToLower(strings.TrimSpace(text))
	hits := []int{}
	ix.Each(func(i int, c *history.Commit) bool {
		if text == "" ||
			strings.HasPrefix(c.Hash, text) ||
			strings.Contains(strings.ToLower(c.Subject), text) ||
			strings.Contains(strings.ToLower(c.Body), text) ||
			strings.Contains(strings.ToLower(c.Author), text) {
			hits = append(hits, i)
		}
		return true
	})
	return hits
}
