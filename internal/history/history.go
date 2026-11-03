// Package history streams the commit log and lays out the graph as it goes.
package history

import (
	"bufio"
	"bytes"
	"context"
	"strings"
	"time"

	"ginGit/internal/gitcmd"
	"ginGit/internal/graph"
)

type Commit struct {
	Hash        string    `json:"hash"`
	Parents     []string  `json:"parents"`
	Author      string    `json:"author"`
	AuthorEmail string    `json:"authorEmail"`
	AuthorDate  time.Time `json:"authorDate"`
	CommitDate  time.Time `json:"commitDate"`
	Subject     string    `json:"subject"`
	// Body stays in Go: search reads it from the index, the UI does not need
	// 86k long commit messages shipped over the bridge.
	Body string    `json:"-"`
	Row  graph.Row `json:"row"`
}

// Options control how commits are delivered.
type Options struct {
	// ChunkSize is how many commits are batched per callback.
	ChunkSize int
}

const recordSep = "\x1e"

// git's format: fields separated by NUL, records by RS. Body may contain
// newlines, which is why we cannot split on them.
const format = "--format=%H%x00%P%x00%an%x00%ae%x00%aI%x00%cI%x00%s%x00%b%x1e"

// Load streams the log, calling emit with each chunk. It returns the total
// count once git exits. A cancelled ctx stops git and returns ctx.Err().
func Load(ctx context.Context, root string, opts Options, emit func([]Commit)) (int, error) {
	if opts.ChunkSize <= 0 {
		opts.ChunkSize = 1000
	}
	stdout, wait, err := gitcmd.Stream(ctx, root, "log", "--topo-order", "--all", format)
	if err != nil {
		return 0, err
	}
	defer stdout.Close()

	layout := graph.New()
	total := 0
	chunk := make([]Commit, 0, opts.ChunkSize)
	flush := func() {
		// A cancelled load must not emit; the UI has already moved on.
		if len(chunk) > 0 && ctx.Err() == nil {
			emit(chunk)
		}
		chunk = make([]Commit, 0, opts.ChunkSize)
	}

	sc := bufio.NewScanner(stdout)
	sc.Buffer(make([]byte, 1024*1024), 64*1024*1024)
	sc.Split(splitRecords)
	for sc.Scan() {
		rec := sc.Bytes()
		c, ok := parse(rec)
		if !ok {
			continue
		}
		c.Row = layout.Next(c.Hash, c.Parents)
		chunk = append(chunk, c)
		total++
		if len(chunk) >= opts.ChunkSize {
			flush()
		}
		if ctx.Err() != nil {
			break
		}
	}
	flush()
	if err := wait(); err != nil {
		return total, err
	}
	if err := sc.Err(); err != nil {
		return total, err
	}
	return total, ctx.Err()
}

func splitRecords(data []byte, atEOF bool) (advance int, token []byte, err error) {
	if i := bytes.IndexByte(data, recordSep[0]); i >= 0 {
		return i + 1, data[:i], nil
	}
	if atEOF && len(data) > 0 {
		return len(data), data, nil
	}
	return 0, nil, nil
}

func parse(rec []byte) (Commit, bool) {
	rec = bytes.TrimLeft(rec, "\n")
	f := strings.Split(string(rec), "\x00")
	if len(f) < 8 || len(f[0]) != 40 {
		return Commit{}, false
	}
	c := Commit{
		Hash:        f[0],
		Author:      f[2],
		AuthorEmail: f[3],
		Subject:     f[6],
		Body:        strings.TrimRight(f[7], "\n"),
	}
	if f[1] != "" {
		c.Parents = strings.Split(f[1], " ")
	} else {
		c.Parents = []string{}
	}
	c.AuthorDate, _ = time.Parse(time.RFC3339, f[4])
	c.CommitDate, _ = time.Parse(time.RFC3339, f[5])
	return c, true
}
